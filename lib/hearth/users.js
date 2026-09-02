// People: finding, creating, and linking identities to them.
//
// One user per email whatever they sign in with. A provider identity links to
// the user whose verified email it carries; a new email makes a new guest.
// The first owner is whoever is on ADMIN_EMAILS (the same allowlist the flame
// admin already uses), and anyone on that list is an owner every time they
// sign in, so the person who runs the company can never be locked out by a
// role edit.

import crypto from "node:crypto";
import { sql } from "./db.js";
import { ROLE_DEFAULTS, effectivePermissions } from "./permissions.js";
import { normalizeEmail } from "./http.js";

export function adminEmails(env = process.env) {
  const value = typeof env.ADMIN_EMAILS === "string" ? env.ADMIN_EMAILS : "";
  return value.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// Referral codes are short, unambiguous and unguessable enough: eight
// characters from an alphabet without look-alikes.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function referralCode() {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export async function ensureRoles() {
  for (const role of ROLE_DEFAULTS) {
    await sql()`
      insert into roles (name, label, description, permissions, position)
      values (${role.name}, ${role.label}, ${role.description}, ${role.permissions}, ${role.position})
      on conflict (name) do nothing
    `;
  }
}

export async function findUserByEmail(email) {
  const rows = await sql()`select * from users where email = ${normalizeEmail(email)}`;
  return rows[0] || null;
}

export async function findUserById(id) {
  const rows = await sql()`select * from users where id = ${id}`;
  return rows[0] || null;
}

export async function createUser({ email, name = "", avatarUrl = null, verified = false, referredBy = null, role = null }) {
  const normalized = normalizeEmail(email);
  const wantedRole = role || (adminEmails().includes(normalized) ? "owner" : "guest");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const rows = await sql()`
        insert into users (email, name, avatar_url, role, referral_code, referred_by, email_verified_at)
        values (${normalized}, ${name || ""}, ${avatarUrl}, ${wantedRole}, ${referralCode()}, ${referredBy},
                ${verified ? new Date().toISOString() : null})
        returning *
      `;
      return rows[0];
    } catch (error) {
      if (attempt === 4 || !/referral_code/.test(String(error?.message))) throw error;
    }
  }
  throw new Error("UserCreateFailed");
}

// Finds or creates the user for a verified provider identity and links it.
// Returns { user, created }.
export async function userForIdentity({ provider, providerId, email, name, avatarUrl, referredBy = null }) {
  const normalized = normalizeEmail(email);
  const linked = await sql()`
    select u.* from identities i join users u on u.id = i.user_id
    where i.provider = ${provider} and i.provider_id = ${providerId}
  `;
  if (linked[0]) {
    if (linked[0].email !== normalized && normalized) {
      // The provider account changed its email; the identity still belongs
      // to the same person. Record it on the identity, not the user.
      await sql()`update identities set email = ${normalized} where provider = ${provider} and provider_id = ${providerId}`;
    }
    return { user: await promoteIfAdmin(linked[0]), created: false };
  }
  let user = await findUserByEmail(normalized);
  let created = false;
  if (!user) {
    user = await createUser({ email: normalized, name, avatarUrl, verified: true, referredBy });
    created = true;
  } else if (!user.email_verified_at) {
    await sql()`update users set email_verified_at = now() where id = ${user.id}`;
  }
  await sql()`
    insert into identities (user_id, provider, provider_id, email)
    values (${user.id}, ${provider}, ${providerId}, ${normalized})
    on conflict (provider, provider_id) do nothing
  `;
  if (!user.name && name) {
    await sql()`update users set name = ${name} where id = ${user.id} and name = ''`;
    user.name = name;
  }
  if (!user.avatar_url && avatarUrl) {
    await sql()`update users set avatar_url = ${avatarUrl} where id = ${user.id} and avatar_url is null`;
    user.avatar_url = avatarUrl;
  }
  return { user: await promoteIfAdmin(user), created };
}

// Anyone on ADMIN_EMAILS is an owner on every sign-in.
export async function promoteIfAdmin(user) {
  if (!user) return user;
  if (user.role !== "owner" && adminEmails().includes(user.email)) {
    await sql()`update users set role = 'owner' where id = ${user.id}`;
    return { ...user, role: "owner" };
  }
  return user;
}

// The user plus their effective permissions, the shape every handler wants.
export async function loadActor(userId) {
  const user = await findUserById(userId);
  if (!user) return null;
  const roleRows = await sql()`select * from roles where name = ${user.role}`;
  const overrides = await sql()`select permission, granted from user_permissions where user_id = ${user.id}`;
  const permissions = effectivePermissions(user, roleRows[0], overrides);
  return { user, role: roleRows[0] || null, permissions };
}

// What the page is allowed to know about a person. Never the whole row.
export function publicUser(user, permissions = null) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatar_url,
    role: user.role,
    status: user.status,
    timezone: user.timezone,
    referralCode: user.referral_code,
    createdAt: user.created_at,
    lastSeenAt: user.last_seen_at,
    emailVerified: Boolean(user.email_verified_at),
    permissions: permissions ? [...permissions] : undefined
  };
}

export async function countOwners() {
  const rows = await sql()`select count(*)::int as n from users where role = 'owner' and status = 'active'`;
  return rows[0]?.n || 0;
}
