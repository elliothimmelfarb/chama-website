// Agents: API keys, connected apps, and the consent page's endpoints.
//
// A key is shown once, at creation, and never again. Connected apps are
// the OAuth clients holding a live refresh token for this member; each can
// be disconnected, which revokes everything that client holds. The consent
// endpoints back /hearth/authorize: the page reads the pending request,
// the person says yes or no, and the answer is where to send them.

import { sql } from "../db.js";
import { HttpError, json, readJson, clampText } from "../http.js";
import { auditor, EVENTS } from "../audit.js";
import {
  SCOPES, parseScopes, DEFAULT_SCOPES, createApiKey, connectedApps, disconnectApp,
  readAuthorization, approveAuthorization, denyAuthorization
} from "../oauth.js";

export function registerAgentRoutes({ route, needs }) {
  route("GET", "/agents", async (context) => {
    needs(context, "keys.own");
    const user = context.actor.user;
    const keys = await sql()`
      select id, name, prefix, scopes, created_at, expires_at, last_used_at from api_keys
      where user_id = ${user.id} and revoked_at is null order by created_at desc
    `;
    const apps = await connectedApps(user.id);
    const calls = await sql()`
      select date_trunc('day', at)::date as day, count(*)::int as n from audit_log
      where actor_user_id = ${user.id} and event = 'mcp.call' and at > now() - interval '30 days' group by 1 order by 1
    `;
    return json({
      scopes: SCOPES,
      defaultScopes: DEFAULT_SCOPES,
      keys: keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, createdAt: k.created_at, expiresAt: k.expires_at, lastUsedAt: k.last_used_at })),
      apps: apps.map((a) => ({ id: a.id, name: a.name, uri: a.client_uri, logo: a.logo_uri, connectedAt: a.connected_at, lastUsedAt: a.last_used_at, scopes: a.scopes })),
      calls: calls.map((c) => ({ day: c.day, event: "mcp.call", n: c.n })),
      mcpUrl: "https://chamainteligente.com/mcp"
    });
  });

  route("POST", "/agents/keys", async (context) => {
    needs(context, "keys.own");
    const body = await readJson(context.request);
    const name = clampText(body.name, 80).trim() || "A key";
    const scopes = parseScopes(body.scopes);
    if (!scopes.length) throw new HttpError(400, "Pick at least one thing the key may do.");
    if (scopes.includes("business") && !context.actor.permissions.has("members.read")) throw new HttpError(403, "Your role does not include running the business.");
    const count = await sql()`select count(*)::int as n from api_keys where user_id = ${context.actor.user.id} and revoked_at is null`;
    if ((count[0]?.n || 0) >= 20) throw new HttpError(400, "Twenty live keys is plenty. Revoke one first.");
    let expiresAt = null;
    if (Number.isInteger(body.expiresInDays) && body.expiresInDays > 0 && body.expiresInDays <= 3650) {
      expiresAt = new Date(Date.now() + body.expiresInDays * 86400000).toISOString();
    }
    const key = await createApiKey({ userId: context.actor.user.id, name, scopes, expiresAt });
    await auditor(context, context.actor.user)(EVENTS.keyCreated, key.id, { name, scopes, prefix: key.prefix });
    return json({ ok: true, key: { id: key.id, name, prefix: key.prefix, scopes, createdAt: key.createdAt, expiresAt }, secret: key.secret });
  });

  route("DELETE", "/agents/keys/:id", async (context, params) => {
    needs(context, "keys.own");
    const rows = await sql()`update api_keys set revoked_at = now() where id = ${params.id} and user_id = ${context.actor.user.id} and revoked_at is null returning prefix`;
    if (!rows[0]) throw new HttpError(404, "Not found.");
    await auditor(context, context.actor.user)(EVENTS.keyRevoked, params.id, { prefix: rows[0].prefix });
    return json({ ok: true });
  });

  route("DELETE", "/agents/apps/:id", async (context, params) => {
    needs(context, "keys.own");
    await disconnectApp(context.actor.user.id, params.id);
    await auditor(context, context.actor.user)(EVENTS.oauthRevoked, params.id);
    return json({ ok: true });
  });

  /* ---------- consent ---------- */

  route("GET", "/agents/consent", async (context) => {
    needs(context, "mcp.connect");
    const url = new URL(context.request.url);
    const pending = await readAuthorization(url.searchParams.get("req"));
    if (!pending) throw new HttpError(404, "That request has expired. Start again from the app.");
    const canBusiness = context.actor.permissions.has("members.read");
    return json({
      client: pending.client,
      scopes: pending.scopes.filter((s) => s !== "business" || canBusiness).map((s) => SCOPES.find((x) => x.key === s)).filter(Boolean),
      redirectHost: (() => { try { return new URL(pending.redirectUri).host; } catch { return ""; } })()
    });
  });

  route("POST", "/agents/consent", async (context) => {
    needs(context, "mcp.connect");
    const body = await readJson(context.request);
    const req = typeof body.req === "string" ? body.req : "";
    if (body.decision !== "approve") {
      const denied = await denyAuthorization(req);
      if (!denied) throw new HttpError(404, "That request has expired.");
      return json({ ok: true, to: denied.redirect });
    }
    let scopes = parseScopes(body.scopes);
    if (!context.actor.permissions.has("members.read")) scopes = scopes.filter((s) => s !== "business");
    const approved = await approveAuthorization(req, context.actor.user.id, scopes);
    if (!approved) throw new HttpError(404, "That request has expired, or nothing was granted.");
    await auditor(context, context.actor.user)(EVENTS.oauthConsent, approved.clientId, { scopes: approved.scopes });
    return json({ ok: true, to: approved.redirect });
  });
}
