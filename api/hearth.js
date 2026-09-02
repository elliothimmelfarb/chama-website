// The Hearth's API: one router for everything the members' room does.
//
// Mounted at /api/hearth/* (Vercel hands the segments over as the `path`
// query parameter; the original pathname is also honoured when present).
// Every handler receives a context: the request, the parsed path params, the
// country and device family, and, once signed in, the actor with their
// effective permissions. A route declares the permission it needs and the
// router refuses before the handler runs.
//
// Three rules hold everywhere in this file: cross-site posts are refused by
// origin, the wire only ever sees one short generic sentence on failure, and
// nothing a visitor sent reaches the console.

import { configured, ready, sql } from "../lib/hearth/db.js";
import {
  HttpError, json, redirect, isSameOrigin, readJson, requestContext, requestOrigin,
  matchPath, isEmail, normalizeEmail, clampText
} from "../lib/hearth/http.js";
import {
  createSession, sessionCookie, clearSessionCookie, readSession, revokeSession,
  revokeAllSessions, listSessions, issueEmailToken, consumeEmailToken, hashPassword,
  verifyPassword, passwordProblem, allow, addressKey
} from "../lib/hearth/auth.js";
import {
  ensureRoles, findUserByEmail, findUserById, createUser, userForIdentity, loadActor,
  publicUser, countOwners, promoteIfAdmin
} from "../lib/hearth/users.js";
import { PERMISSIONS, ROLE_NAMES, sanitizePermissionList } from "../lib/hearth/permissions.js";
import { audit, auditor, EVENTS } from "../lib/hearth/audit.js";
import * as mail from "../lib/hearth/mail.js";
import { registerSessionRoutes } from "../lib/hearth/routes/sessions.js";
import { registerTranscriptRoutes } from "../lib/hearth/routes/transcripts.js";
import { registerAgentRoutes } from "../lib/hearth/routes/agents.js";
import { registerFeedRoutes } from "../lib/hearth/routes/feed.js";
import {
  availableProviders, providerConfig, verifyGoogleIdToken, issueState, consumeState,
  githubAuthorizeUrl, githubExchange, discordAuthorizeUrl, discordExchange
} from "../lib/hearth/providers.js";

export const MESSAGES = {
  unconfigured: "The Hearth is not open yet.",
  refused: "This request could not be accepted.",
  signedOut: "Please sign in.",
  forbidden: "You do not have access to that.",
  notFound: "Not found.",
  rejected: "Sign-in was not accepted.",
  slowDown: "Too many attempts. Try again in a little while."
};

const HEARTH_PATH = "/hearth";

/* ---------- routing table ---------- */

const routes = [];

function route(method, pattern, handler, options = {}) {
  routes.push({ method, pattern, handler, ...options });
}

function resolvePath(request) {
  const url = new URL(request.url);
  let path = url.pathname.startsWith("/api/hearth") ? url.pathname.slice("/api/hearth".length) : "";
  if (!path || path === "/") {
    const segments = url.searchParams.getAll("path");
    if (segments.length) path = "/" + segments.map((s) => s.split("/")).flat().filter(Boolean).join("/");
  }
  return { url, path: path || "/" };
}

/* ---------- settings ---------- */

export const SETTING_DEFAULTS = {
  session_minutes: 60,
  min_notice_hours: 24,
  booking_horizon_days: 60,
  cancel_notice_hours: 24,
  meeting_url: "",
  referral_reward: { type: "session_credit", amount: 1 },
  feed_public: false,
  mcp_public: false,
  open_signup: true,
  owner_timezone: "Europe/Lisbon"
};

export async function readSettings() {
  const rows = await sql()`select key, value from settings`;
  const out = { ...SETTING_DEFAULTS };
  for (const row of rows) if (row.key in out) out[row.key] = row.value;
  return out;
}

function validSetting(key, value) {
  switch (key) {
    case "session_minutes":
    case "min_notice_hours":
    case "booking_horizon_days":
    case "cancel_notice_hours":
      return Number.isInteger(value) && value >= 0 && value <= 100000;
    case "meeting_url":
      return typeof value === "string" && (value === "" || /^https:\/\/[^\s]{1,500}$/.test(value));
    case "referral_reward":
      return (
        value && typeof value === "object" &&
        ["session_credit", "percent_off"].includes(value.type) &&
        Number.isInteger(value.amount) && value.amount >= 0 && value.amount <= 100
      );
    case "feed_public":
    case "mcp_public":
    case "open_signup":
      return typeof value === "boolean";
    case "owner_timezone":
      return typeof value === "string" && value.length <= 64;
    default:
      return false;
  }
}

// Default roles are seeded once per instance, not once per request.
let rolesPromise = null;
function rolesReady() {
  if (!rolesPromise) {
    rolesPromise = ensureRoles().catch((error) => {
      rolesPromise = null;
      throw error;
    });
  }
  return rolesPromise;
}

/* ---------- the actor ---------- */

async function loadContext(request, injected = null) {
  const context = { request, ...requestContext(request), actor: null, session: null, actorKind: "user", actorRef: null };
  if (injected && injected.actor) {
    context.actor = injected.actor;
    context.actorKind = injected.actorKind || "agent";
    context.actorRef = injected.actorRef || null;
    return context;
  }
  const session = await readSession(request);
  if (session) {
    const actor = await loadActor(session.userId);
    if (actor && actor.user.status === "active") {
      context.actor = actor;
      context.session = session;
    }
  }
  return context;
}

function needs(context, permission) {
  if (!context.actor) throw new HttpError(401, MESSAGES.signedOut);
  if (permission && !context.actor.permissions.has(permission)) throw new HttpError(403, MESSAGES.forbidden);
}

async function finishSignIn(context, user, { created = false, provider, next = HEARTH_PATH } = {}) {
  const { token } = await createSession(user.id, context);
  await audit({
    actor: user.id, event: created ? EVENTS.userCreated : EVENTS.signIn,
    target: user.id, meta: { provider }, country: context.country, device: context.device
  });
  if (created) {
    await audit({ actor: user.id, event: EVENTS.signIn, target: user.id, meta: { provider }, country: context.country, device: context.device });
  }
  const to = typeof next === "string" && next.startsWith(HEARTH_PATH) ? next : HEARTH_PATH;
  return { cookie: sessionCookie(token), to };
}

// Referral attribution at sign-up: the code came with the request (from the
// ?ref= the page remembered). It only ever attaches to a brand-new user.
async function referrerFor(code) {
  if (typeof code !== "string" || !/^[a-z0-9]{6,12}$/.test(code)) return null;
  const rows = await sql()`select id from users where referral_code = ${code} and status = 'active'`;
  return rows[0]?.id || null;
}

async function recordReferral(referrerId, referredId) {
  if (!referrerId || referrerId === referredId) return;
  await sql()`
    insert into referral_events (referrer_id, referred_id) values (${referrerId}, ${referredId})
    on conflict (referred_id) do nothing
  `;
}

/* ---------- public config and the actor ---------- */

route("GET", "/config", async () => {
  const settings = await readSettings();
  return json({ providers: availableProviders(), openSignup: settings.open_signup });
});

route("GET", "/me", async (context) => {
  if (!context.actor) return json({ error: MESSAGES.signedOut }, 401);
  const { user, permissions } = context.actor;
  const settings = await readSettings();
  return json({
    user: publicUser(user, permissions),
    role: context.actor.role ? { name: context.actor.role.name, label: context.actor.role.label } : null,
    settings: { sessionMinutes: settings.session_minutes, meetingUrl: settings.meeting_url ? true : false }
  });
});

/* ---------- Google ---------- */

route("POST", "/auth/google", async (context) => {
  const body = await readJson(context.request);
  if (!(await allow(`google:${addressKey(context.request)}`, 20, 900))) throw new HttpError(429, MESSAGES.slowDown);
  const result = await verifyGoogleIdToken(body.credential);
  if (!result.ok) {
    console.warn("Hearth Google sign-in rejected", result.reason);
    await audit({ event: EVENTS.failed, meta: { provider: "google" }, country: context.country, device: context.device });
    throw new HttpError(401, MESSAGES.rejected);
  }
  const settings = await readSettings();
  const existing = await findUserByEmail(result.identity.email);
  if (!existing && !settings.open_signup) throw new HttpError(403, MESSAGES.forbidden);
  const referredBy = existing ? null : await referrerFor(body.ref);
  const { user, created } = await userForIdentity({ ...result.identity, referredBy });
  if (created) await recordReferral(referredBy, user.id);
  const { cookie, to } = await finishSignIn(context, user, { created, provider: "google", next: body.next });
  return json({ ok: true, to }, 200, { "Set-Cookie": cookie });
});

/* ---------- GitHub and Discord ---------- */

function callbackUrl(request, provider) {
  return `${requestOrigin(request)}/api/hearth/auth/${provider}/callback`;
}

route("GET", "/auth/:provider", async (context, params) => {
  const provider = params.provider;
  const config = providerConfig()[provider];
  const available = availableProviders();
  if (!["github", "discord"].includes(provider) || !available[provider]) throw new HttpError(404, MESSAGES.notFound);
  const url = new URL(context.request.url);
  const state = await issueState(provider, {
    ref: url.searchParams.get("ref") || "",
    next: url.searchParams.get("next") || ""
  });
  const args = { clientId: config.clientId, redirectUri: callbackUrl(context.request, provider), state };
  return redirect(provider === "github" ? githubAuthorizeUrl(args) : discordAuthorizeUrl(args));
});

route("GET", "/auth/:provider/callback", async (context, params) => {
  const provider = params.provider;
  if (!["github", "discord"].includes(provider)) throw new HttpError(404, MESSAGES.notFound);
  const url = new URL(context.request.url);
  const meta = await consumeState(provider, url.searchParams.get("state"));
  const code = url.searchParams.get("code");
  const failed = () => redirect(`${HEARTH_PATH}?error=signin`);
  if (!meta || typeof code !== "string" || !code) return failed();
  const exchange = provider === "github" ? githubExchange : discordExchange;
  const result = await exchange({ code, redirectUri: callbackUrl(context.request, provider) });
  if (!result.ok) {
    console.warn("Hearth provider sign-in rejected", provider, result.reason);
    await audit({ event: EVENTS.failed, meta: { provider }, country: context.country, device: context.device });
    return failed();
  }
  const settings = await readSettings();
  const existing = await findUserByEmail(result.identity.email);
  if (!existing && !settings.open_signup) return failed();
  const referredBy = existing ? null : await referrerFor(meta.ref);
  const { user, created } = await userForIdentity({ ...result.identity, referredBy });
  if (created) await recordReferral(referredBy, user.id);
  const { cookie, to } = await finishSignIn(context, user, { created, provider, next: meta.next });
  return redirect(to, 302, { "Set-Cookie": cookie });
});

/* ---------- email: magic link ---------- */

route("POST", "/auth/email/start", async (context) => {
  const body = await readJson(context.request);
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) throw new HttpError(400, "That does not look like an email address.");
  const okAddress = await allow(`email:addr:${addressKey(context.request)}`, 20, 900);
  const okEmail = await allow(`email:to:${email}`, 5, 900);
  if (!okAddress || !okEmail) throw new HttpError(429, MESSAGES.slowDown);
  const settings = await readSettings();
  const existing = await findUserByEmail(email);
  // The answer is the same whether or not the address is known, so the
  // endpoint cannot be used to learn who is a member.
  if (!existing && !settings.open_signup) return json({ ok: true });
  const token = await issueEmailToken({
    email, userId: existing?.id || null, purpose: "magic",
    meta: { ref: typeof body.ref === "string" ? body.ref.slice(0, 16) : "", next: typeof body.next === "string" ? body.next.slice(0, 200) : "" }
  });
  const link = `${requestOrigin(context.request)}/api/hearth/auth/email/callback?token=${encodeURIComponent(token)}`;
  try {
    await mail.send({ to: email, ...mail.magicLinkMessage({ link, isNew: !existing }) });
  } catch (error) {
    console.error("Hearth magic link failed", error instanceof Error ? error.message : "UnknownError");
    throw new HttpError(503, "The email could not be sent right now. Try again in a minute, or use another way in.");
  }
  await audit({ actor: existing?.id || null, event: EVENTS.linkSent, meta: { purpose: "magic" }, country: context.country, device: context.device });
  return json({ ok: true });
});

route("GET", "/auth/email/callback", async (context) => {
  const url = new URL(context.request.url);
  const row = await consumeEmailToken(url.searchParams.get("token"), "magic");
  if (!row) return redirect(`${HEARTH_PATH}?error=link`);
  let user = row.user_id ? await findUserById(row.user_id) : await findUserByEmail(row.email);
  let created = false;
  if (!user) {
    const referredBy = await referrerFor(row.meta?.ref);
    user = await createUser({ email: row.email, verified: true, referredBy });
    await recordReferral(referredBy, user.id);
    created = true;
  } else {
    if (!user.email_verified_at) await sql()`update users set email_verified_at = now() where id = ${user.id}`;
    user = await promoteIfAdmin(user);
  }
  if (user.status !== "active") return redirect(`${HEARTH_PATH}?error=suspended`);
  const { cookie, to } = await finishSignIn(context, user, { created, provider: "email", next: row.meta?.next });
  return redirect(created ? `${to}?welcome=1` : to, 302, { "Set-Cookie": cookie });
});

/* ---------- email: passwords ---------- */

route("POST", "/auth/password", async (context) => {
  const body = await readJson(context.request);
  const email = normalizeEmail(body.email);
  if (!isEmail(email) || typeof body.password !== "string") throw new HttpError(401, MESSAGES.rejected);
  const okAddress = await allow(`pw:addr:${addressKey(context.request)}`, 20, 900);
  const okEmail = await allow(`pw:to:${email}`, 8, 900);
  if (!okAddress || !okEmail) throw new HttpError(429, MESSAGES.slowDown);
  const user = await findUserByEmail(email);
  const rows = user ? await sql()`select password_hash from credentials where user_id = ${user.id}` : [];
  const stored = rows[0]?.password_hash || null;
  // Verify even when there is nothing to compare, so timing does not reveal
  // whether the address has a password.
  const ok = verifyPassword(body.password, stored || "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!user || !stored || !ok || !user.email_verified_at || user.status !== "active") {
    await audit({ actor: user?.id || null, event: EVENTS.failed, meta: { provider: "password" }, country: context.country, device: context.device });
    throw new HttpError(401, MESSAGES.rejected);
  }
  const promoted = await promoteIfAdmin(user);
  const { cookie, to } = await finishSignIn(context, promoted, { provider: "password", next: body.next });
  return json({ ok: true, to }, 200, { "Set-Cookie": cookie });
});

route("POST", "/auth/password/set", async (context) => {
  needs(context);
  const body = await readJson(context.request);
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);
  const user = context.actor.user;
  await sql()`
    insert into credentials (user_id, password_hash, password_set_at, updated_at)
    values (${user.id}, ${hashPassword(body.password)}, now(), now())
    on conflict (user_id) do update set password_hash = excluded.password_hash, password_set_at = now(), updated_at = now()
  `;
  await auditor(context, user)(EVENTS.passwordSet, user.id);
  return json({ ok: true });
});

route("DELETE", "/auth/password", async (context) => {
  needs(context);
  const user = context.actor.user;
  await sql()`update credentials set password_hash = null, updated_at = now() where user_id = ${user.id}`;
  await auditor(context, user)(EVENTS.passwordSet, user.id, { removed: true });
  return json({ ok: true });
});

route("POST", "/auth/password/forgot", async (context) => {
  const body = await readJson(context.request);
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) throw new HttpError(400, "That does not look like an email address.");
  const okAddress = await allow(`reset:addr:${addressKey(context.request)}`, 10, 900);
  const okEmail = await allow(`reset:to:${email}`, 3, 900);
  if (!okAddress || !okEmail) throw new HttpError(429, MESSAGES.slowDown);
  const user = await findUserByEmail(email);
  if (user) {
    const token = await issueEmailToken({ email, userId: user.id, purpose: "reset" });
    const link = `${requestOrigin(context.request)}${HEARTH_PATH}/reset?token=${encodeURIComponent(token)}`;
    try {
      await mail.send({ to: email, ...mail.resetMessage({ link }) });
    } catch (error) {
      console.error("Hearth reset mail failed", error instanceof Error ? error.message : "UnknownError");
    }
    await auditor(context, user)(EVENTS.linkSent, user.id, { purpose: "reset" });
  }
  return json({ ok: true });
});

route("POST", "/auth/password/reset", async (context) => {
  const body = await readJson(context.request);
  const problem = passwordProblem(body.password);
  if (problem) throw new HttpError(400, problem);
  const row = await consumeEmailToken(body.token, "reset");
  if (!row || !row.user_id) throw new HttpError(400, "That link is no longer valid.");
  await sql()`
    insert into credentials (user_id, password_hash, password_set_at, updated_at)
    values (${row.user_id}, ${hashPassword(body.password)}, now(), now())
    on conflict (user_id) do update set password_hash = excluded.password_hash, password_set_at = now(), updated_at = now()
  `;
  await sql()`update users set email_verified_at = coalesce(email_verified_at, now()) where id = ${row.user_id}`;
  await revokeAllSessions(row.user_id);
  await audit({ actor: row.user_id, event: EVENTS.passwordSet, target: row.user_id, meta: { reset: true }, country: context.country, device: context.device });
  return json({ ok: true });
});

/* ---------- signing out, sessions, profile ---------- */

route("POST", "/auth/signout", async (context) => {
  if (context.session) {
    await revokeSession(context.session.id, context.actor.user.id);
    await auditor(context, context.actor.user)(EVENTS.signOut, context.session.id);
  }
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
});

route("POST", "/auth/signout-all", async (context) => {
  needs(context);
  await revokeAllSessions(context.actor.user.id);
  await auditor(context, context.actor.user)(EVENTS.signOutAll, context.actor.user.id);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
});

route("GET", "/sessions", async (context) => {
  needs(context);
  const rows = await listSessions(context.actor.user.id);
  return json({
    current: context.session.id,
    sessions: rows.map((r) => ({
      id: r.id, createdAt: r.created_at, lastSeenAt: r.last_seen_at, device: r.device, country: r.country
    }))
  });
});

route("DELETE", "/sessions/:id", async (context, params) => {
  needs(context);
  await revokeSession(params.id, context.actor.user.id);
  await auditor(context, context.actor.user)(EVENTS.signOut, params.id, { remote: true });
  return json({ ok: true });
});

route("GET", "/security", async (context) => {
  needs(context);
  const user = context.actor.user;
  const identities = await sql()`select provider, email, created_at from identities where user_id = ${user.id} order by created_at`;
  const cred = await sql()`select password_set_at from credentials where user_id = ${user.id}`;
  return json({
    identities: identities.map((i) => ({ provider: i.provider, email: i.email, createdAt: i.created_at })),
    hasPassword: Boolean(cred[0]?.password_set_at)
  });
});

route("PATCH", "/profile", async (context) => {
  needs(context);
  const body = await readJson(context.request);
  const user = context.actor.user;
  const name = typeof body.name === "string" ? clampText(body.name, 120).trim() : user.name;
  const timezone = typeof body.timezone === "string" && body.timezone.length <= 64 ? body.timezone : user.timezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new HttpError(400, "That timezone is not recognised.");
  }
  await sql()`update users set name = ${name}, timezone = ${timezone} where id = ${user.id}`;
  await auditor(context, user)(EVENTS.profileUpdated, user.id);
  return json({ ok: true });
});

/* ---------- the business: members, roles, settings, log, metrics ---------- */

route("GET", "/admin/permissions", async (context) => {
  needs(context, "members.read");
  return json({ permissions: PERMISSIONS, roles: ROLE_NAMES });
});

route("GET", "/admin/members", async (context) => {
  needs(context, "members.read");
  const url = new URL(context.request.url);
  const q = clampText(url.searchParams.get("q") || "", 100).toLowerCase();
  const role = url.searchParams.get("role") || "";
  const rows = await sql()`
    select u.*, (select count(*)::int from login_sessions s where s.user_id = u.id and s.revoked_at is null and s.expires_at > now()) as live_sessions
    from users u
    where (${q} = '' or lower(u.email) like ${"%" + q + "%"} or lower(u.name) like ${"%" + q + "%"})
      and (${role} = '' or u.role = ${role})
    order by coalesce(u.last_seen_at, u.created_at) desc
    limit 500
  `;
  return json({
    members: rows.map((u) => ({ ...publicUser(u), liveSessions: u.live_sessions, notes: u.notes, referredBy: u.referred_by }))
  });
});

route("GET", "/admin/members/:id", async (context, params) => {
  needs(context, "members.read");
  const user = await findUserById(params.id);
  if (!user) throw new HttpError(404, MESSAGES.notFound);
  const identities = await sql()`select provider, email, created_at from identities where user_id = ${user.id}`;
  const overrides = await sql()`select permission, granted from user_permissions where user_id = ${user.id}`;
  const sessions = await listSessions(user.id);
  const recent = await sql()`
    select id, at, event, target, meta, country, device from audit_log
    where actor_user_id = ${user.id} order by at desc limit 50
  `;
  const referrals = await sql()`
    select r.status, r.created_at, u.email, u.name from referral_events r join users u on u.id = r.referred_id
    where r.referrer_id = ${user.id} order by r.created_at desc
  `;
  const referrer = user.referred_by ? await findUserById(user.referred_by) : null;
  return json({
    member: { ...publicUser(user), notes: user.notes },
    identities,
    overrides,
    sessions: sessions.map((s) => ({ id: s.id, createdAt: s.created_at, lastSeenAt: s.last_seen_at, device: s.device, country: s.country })),
    recent,
    referrals,
    referrer: referrer ? { email: referrer.email, name: referrer.name } : null
  });
});

route("PATCH", "/admin/members/:id", async (context, params) => {
  needs(context, "members.manage");
  const body = await readJson(context.request);
  const target = await findUserById(params.id);
  if (!target) throw new HttpError(404, MESSAGES.notFound);
  const actor = context.actor.user;
  const log = auditor(context, actor);
  if (typeof body.role === "string" && body.role !== target.role) {
    if (!ROLE_NAMES.includes(body.role)) throw new HttpError(400, "Unknown role.");
    // Only an owner hands out or takes away ownership, and never the last one.
    if ((body.role === "owner" || target.role === "owner") && actor.role !== "owner") throw new HttpError(403, MESSAGES.forbidden);
    if (target.role === "owner" && (await countOwners()) <= 1) throw new HttpError(400, "There must always be one owner.");
    await sql()`update users set role = ${body.role} where id = ${target.id}`;
    await log(EVENTS.roleChanged, target.id, { from: target.role, to: body.role });
  }
  if (typeof body.status === "string" && body.status !== target.status) {
    if (!["active", "suspended"].includes(body.status)) throw new HttpError(400, "Unknown status.");
    if (target.role === "owner" && actor.role !== "owner") throw new HttpError(403, MESSAGES.forbidden);
    if (target.id === actor.id) throw new HttpError(400, "You cannot suspend yourself.");
    await sql()`update users set status = ${body.status} where id = ${target.id}`;
    if (body.status === "suspended") await revokeAllSessions(target.id);
    await log(EVENTS.statusChanged, target.id, { to: body.status });
  }
  if (typeof body.notes === "string") {
    await sql()`update users set notes = ${clampText(body.notes, 4000)} where id = ${target.id}`;
  }
  return json({ ok: true });
});

route("PUT", "/admin/members/:id/permissions", async (context, params) => {
  needs(context, "members.manage");
  const body = await readJson(context.request);
  const target = await findUserById(params.id);
  if (!target) throw new HttpError(404, MESSAGES.notFound);
  const [permission] = sanitizePermissionList([body.permission]);
  if (!permission) throw new HttpError(400, "Unknown permission.");
  if (target.role === "owner") throw new HttpError(400, "An owner already holds every permission.");
  if (body.granted === null || body.granted === undefined) {
    await sql()`delete from user_permissions where user_id = ${target.id} and permission = ${permission}`;
  } else {
    await sql()`
      insert into user_permissions (user_id, permission, granted) values (${target.id}, ${permission}, ${Boolean(body.granted)})
      on conflict (user_id, permission) do update set granted = excluded.granted
    `;
  }
  await auditor(context, context.actor.user)(EVENTS.overrideChanged, target.id, { permission, granted: body.granted ?? null });
  return json({ ok: true });
});

route("POST", "/admin/invite", async (context) => {
  needs(context, "members.manage");
  const body = await readJson(context.request);
  const email = normalizeEmail(body.email);
  if (!isEmail(email)) throw new HttpError(400, "That does not look like an email address.");
  const role = ROLE_NAMES.includes(body.role) ? body.role : "client";
  if (role === "owner" && context.actor.user.role !== "owner") throw new HttpError(403, MESSAGES.forbidden);
  let user = await findUserByEmail(email);
  let created = false;
  if (!user) {
    user = await createUser({ email, name: typeof body.name === "string" ? clampText(body.name, 120) : "", role });
    created = true;
  } else if (user.role !== role && user.role !== "owner") {
    await sql()`update users set role = ${role} where id = ${user.id}`;
  }
  const token = await issueEmailToken({ email, userId: user.id, purpose: "magic", meta: { invite: true } });
  const link = `${requestOrigin(context.request)}/api/hearth/auth/email/callback?token=${encodeURIComponent(token)}`;
  const roleLabel = (await sql()`select label from roles where name = ${role}`)[0]?.label || role;
  try {
    await mail.send({ to: email, ...mail.inviteMessage({ link, roleLabel, fromName: context.actor.user.name || "Elliot" }) });
  } catch (error) {
    console.error("Hearth invite mail failed", error instanceof Error ? error.message : "UnknownError");
    throw new HttpError(503, "The invitation could not be emailed right now.");
  }
  await auditor(context, context.actor.user)(created ? EVENTS.userCreated : EVENTS.linkSent, user.id, { invited: true, role });
  return json({ ok: true, id: user.id });
});

route("GET", "/admin/roles", async (context) => {
  needs(context, "members.read");
  const rows = await sql()`select name, label, description, permissions, position from roles order by position`;
  return json({ roles: rows, catalog: PERMISSIONS });
});

route("PUT", "/admin/roles/:name", async (context, params) => {
  needs(context, "roles.manage");
  if (!ROLE_NAMES.includes(params.name)) throw new HttpError(404, MESSAGES.notFound);
  if (params.name === "owner") throw new HttpError(400, "The owner role always holds every permission.");
  const body = await readJson(context.request);
  const permissions = sanitizePermissionList(body.permissions);
  await sql()`update roles set permissions = ${permissions}, updated_at = now() where name = ${params.name}`;
  await auditor(context, context.actor.user)(EVENTS.roleUpdated, params.name, { permissions });
  return json({ ok: true });
});

route("GET", "/admin/settings", async (context) => {
  needs(context, "settings.manage");
  return json({ settings: await readSettings() });
});

route("PUT", "/admin/settings", async (context) => {
  needs(context, "settings.manage");
  const body = await readJson(context.request);
  const changed = [];
  for (const [key, value] of Object.entries(body)) {
    if (!(key in SETTING_DEFAULTS)) continue;
    if (!validSetting(key, value)) throw new HttpError(400, `That value for ${key} is not allowed.`);
    await sql()`
      insert into settings (key, value, updated_by) values (${key}, ${JSON.stringify(value)}::jsonb, ${context.actor.user.id})
      on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by
    `;
    changed.push(key);
  }
  await auditor(context, context.actor.user)(EVENTS.settingsUpdated, null, { keys: changed });
  return json({ ok: true, settings: await readSettings() });
});

route("GET", "/admin/audit", async (context) => {
  needs(context, "audit.read");
  const url = new URL(context.request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const before = Number(url.searchParams.get("before")) || null;
  const event = clampText(url.searchParams.get("event") || "", 60);
  const actor = clampText(url.searchParams.get("actor") || "", 40);
  const rows = await sql()`
    select l.id, l.at, l.actor_user_id, l.actor_kind, l.actor_ref, l.event, l.target, l.meta, l.country, l.device,
           u.email as actor_email, u.name as actor_name
    from audit_log l left join users u on u.id = l.actor_user_id
    where (${before}::bigint is null or l.id < ${before}::bigint)
      and (${event} = '' or l.event like ${event + "%"})
      and (${actor} = '' or l.actor_user_id::text = ${actor})
    order by l.id desc limit ${limit}
  `;
  return json({ entries: rows, nextBefore: rows.length === limit ? rows[rows.length - 1].id : null });
});

route("GET", "/admin/metrics", async (context) => {
  needs(context, "metrics.read");
  const days = 30;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const [byDay, byRole, presence, totals, topTools] = await Promise.all([
    sql()`
      select date_trunc('day', at)::date as day, event, count(*)::int as n from audit_log
      where at >= ${since} and event in ('auth.sign_in', 'user.created', 'mcp.call', 'booking.created', 'purchase.paid', 'transcript.derived')
      group by 1, 2 order by 1
    `,
    sql()`select role, count(*)::int as n from users where status = 'active' group by role`,
    sql()`select id, name, email, role, last_seen_at from users where last_seen_at > now() - interval '5 minutes' order by last_seen_at desc limit 50`,
    sql()`
      select
        (select count(*)::int from users where status = 'active') as members,
        (select count(*)::int from users where status = 'active' and last_seen_at > now() - interval '7 days') as active_week,
        (select count(*)::int from login_sessions where revoked_at is null and expires_at > now()) as live_sessions,
        (select count(*)::int from api_keys where revoked_at is null) as api_keys,
        (select count(*)::int from oauth_tokens where kind = 'refresh' and revoked_at is null and expires_at > now()) as connected_agents,
        (select count(*)::int from audit_log where event = 'mcp.call' and at >= ${since}) as mcp_calls
    `,
    sql()`
      select meta->>'tool' as tool, count(*)::int as n from audit_log
      where event = 'mcp.call' and at >= ${since} group by 1 order by 2 desc limit 12
    `
  ]);
  return json({ days, byDay, byRole, presence: presence.map((u) => publicUser(u)), totals: totals[0], topTools });
});

registerSessionRoutes({ route, needs, readSettings });
registerTranscriptRoutes({ route, needs, readSettings });
registerAgentRoutes({ route, needs, readSettings });
registerFeedRoutes({ route, needs, readSettings });

/* ---------- dispatch ---------- */

export async function handleHearth(request, injected = null) {
  if (!configured()) return json({ error: MESSAGES.unconfigured }, 503);
  const { path } = resolvePath(request);
  const method = request.method.toUpperCase();
  let methodSeen = false;
  const candidates = [];
  for (const candidate of routes) {
    const p = matchPath(candidate.pattern, path);
    if (!p) continue;
    methodSeen = true;
    if (candidate.method !== method) continue;
    candidates.push({ candidate, params: p });
  }
  // A literal pattern wins over one with named segments, so
  // /auth/email/callback is not swallowed by /auth/:provider/callback.
  const chosen = candidates.find(({ candidate }) => !candidate.pattern.includes(":")) || candidates[0] || null;
  const matched = chosen ? chosen.candidate : null;
  const params = chosen ? chosen.params : null;
  if (!matched) return json({ error: MESSAGES.notFound }, methodSeen ? 405 : 404);
  if (!injected && method !== "GET" && !isSameOrigin(request)) return json({ error: MESSAGES.refused }, 403);
  try {
    await ready();
    await rolesReady();
    const context = await loadContext(request, injected);
    return await matched.handler(context, params);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message, ...error.extra }, error.status);
    console.error("Hearth request failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return json({ error: MESSAGES.refused }, 500);
  }
}

export default {
  async fetch(request) {
    return await handleHearth(request);
  }
};
