// The parts of the room beyond its core (assets/hearth.js), and who loads
// each one. /me sends a member the list of parts their permissions open, and
// the room loads only those. This saves the download and nothing more: the
// API checks every permission on every call whatever the page has loaded.
//
// The order is the order the parts register in, which sets the order of the
// tiles on Home. A part loads when the person holds any permission in `any`,
// or always when it has rooms everyone uses. modules.test.js runs each file
// to keep this list honest.

export const ROOM_MODULES = [
  { name: "hearth-admin", any: ["members.read", "roles.manage", "audit.read", "metrics.read", "settings.manage"] },
  // Billing details and invoices are for everyone: a guest can be billed.
  { name: "hearth-sessions", always: true },
  { name: "hearth-sessions-admin", any: ["sessions.manage", "packs.manage", "purchases.manage", "availability.manage"] },
  { name: "hearth-transcripts", any: ["transcripts.own", "sessions.own"] },
  { name: "hearth-transcripts-admin", any: ["transcripts.manage"] },
  { name: "hearth-remember", any: ["transcripts.own"] },
  { name: "hearth-agents", any: ["keys.own", "mcp.connect"] },
  { name: "hearth-feed", any: ["feed.read"] },
  { name: "hearth-ask", any: ["transcripts.own"] }
];

export function roomModulesFor(permissions) {
  const held = permissions instanceof Set ? permissions : new Set();
  return ROOM_MODULES.filter((m) => m.always || m.any.some((key) => held.has(key))).map((m) => m.name);
}
