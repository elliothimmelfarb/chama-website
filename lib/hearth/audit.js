// The audit log: one append-only table every part of the Hearth writes to.
//
// What goes in: who (a user id, an API key, an OAuth client, the system),
// what happened (a short dotted event name), what it was about (a target id
// or path), a small JSON of details, and the country and device family from
// the request. What never goes in: IP addresses, raw user agents, visitor
// text, tokens. A logging failure is swallowed after a console line so it can
// never take a request down.

import { sql } from "./db.js";

export const EVENTS = {
  signIn: "auth.sign_in",
  signOut: "auth.sign_out",
  signOutAll: "auth.sign_out_all",
  failed: "auth.failed",
  linkSent: "auth.link_sent",
  verified: "auth.email_verified",
  passwordSet: "auth.password_set",
  userCreated: "user.created",
  profileUpdated: "user.profile_updated",
  roleChanged: "member.role_changed",
  statusChanged: "member.status_changed",
  overrideChanged: "member.permission_changed",
  roleUpdated: "role.updated",
  settingsUpdated: "settings.updated",
  keyCreated: "key.created",
  keyRevoked: "key.revoked",
  mcpCall: "mcp.call",
  oauthClientRegistered: "oauth.client_registered",
  oauthConsent: "oauth.consent",
  oauthRevoked: "oauth.revoked"
};

export async function audit(entry) {
  const {
    actor = null,
    actorKind = "user",
    actorRef = null,
    event,
    target = null,
    meta = {},
    country = "",
    device = ""
  } = entry;
  try {
    await sql()`
      insert into audit_log (actor_user_id, actor_kind, actor_ref, event, target, meta, country, device)
      values (${actor}, ${actorKind}, ${actorRef}, ${event}, ${target}, ${JSON.stringify(meta)}::jsonb, ${country}, ${device})
    `;
  } catch (error) {
    console.error("Audit write failed", error instanceof Error ? error.name : "UnknownError");
  }
}

// A convenience for handlers that already hold a request context and a user.
export function auditor(context, user) {
  return (event, target, meta) =>
    audit({
      actor: user ? user.id : null,
      actorKind: context.actorKind || "user",
      actorRef: context.actorRef || null,
      event,
      target,
      meta,
      country: context.country,
      device: context.device
    });
}
