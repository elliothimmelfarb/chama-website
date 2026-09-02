// Roles and permissions.
//
// A permission is a short dotted key. A role is a named set of them, stored in
// the roles table so the owner can reshape a role from the room. The owner
// role is the one exception: it always holds every permission and cannot be
// edited into a lockout. Per-user overrides sit on top (grant or deny one
// permission to one person without inventing a role for them).

export const PERMISSIONS = [
  { key: "hearth.enter", label: "Enter the Hearth", group: "Room" },
  { key: "feed.read", label: "Read the members' feed", group: "Room" },
  { key: "feed.read.clients", label: "Read posts marked for clients", group: "Room" },
  { key: "feed.write", label: "Write to the feed", group: "Room" },
  { key: "sessions.own", label: "Book and manage their own sessions", group: "Coaching" },
  { key: "transcripts.own", label: "Read their own transcripts and summaries", group: "Coaching" },
  { key: "packs.buy", label: "Request session packs", group: "Coaching" },
  { key: "keys.own", label: "Create API keys and connect agents", group: "Agents" },
  { key: "mcp.connect", label: "Use the MCP server", group: "Agents" },
  { key: "members.read", label: "See the member list", group: "Business" },
  { key: "members.manage", label: "Change roles, suspend, invite", group: "Business" },
  { key: "roles.manage", label: "Edit what each role can do", group: "Business" },
  { key: "packs.manage", label: "Set packs and prices", group: "Business" },
  { key: "purchases.manage", label: "Mark purchases invoiced and paid", group: "Business" },
  { key: "availability.manage", label: "Set availability and blocks", group: "Business" },
  { key: "sessions.manage", label: "See and manage every session", group: "Business" },
  { key: "transcripts.manage", label: "Attach and process transcripts", group: "Business" },
  { key: "metrics.read", label: "Read metrics", group: "Business" },
  { key: "audit.read", label: "Read the audit log", group: "Business" },
  { key: "settings.manage", label: "Change settings", group: "Business" },
  { key: "flame.admin", label: "Read the flame's conversations and notes", group: "Business" }
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLE_DEFAULTS = [
  {
    name: "owner",
    label: "Owner",
    description: "Runs the company. Holds every permission, always.",
    position: 0,
    permissions: PERMISSION_KEYS
  },
  {
    name: "staff",
    label: "Staff",
    description: "A member of the business. Sees members, sessions and metrics; writes to the feed.",
    position: 1,
    permissions: [
      "hearth.enter", "feed.read", "feed.read.clients", "feed.write",
      "sessions.own", "transcripts.own", "keys.own", "mcp.connect",
      "members.read", "sessions.manage", "transcripts.manage", "purchases.manage",
      "metrics.read", "audit.read"
    ]
  },
  {
    name: "client",
    label: "Client",
    description: "Works with Elliot. Books sessions, owns their transcripts, connects their agents.",
    position: 2,
    permissions: [
      "hearth.enter", "feed.read", "feed.read.clients",
      "sessions.own", "transcripts.own", "packs.buy", "keys.own", "mcp.connect"
    ]
  },
  {
    name: "guest",
    label: "Guest",
    description: "Signed up, not yet a client. Reads the feed and can ask to become one.",
    position: 3,
    permissions: ["hearth.enter", "feed.read", "packs.buy", "keys.own", "mcp.connect"]
  }
];

export const ROLE_NAMES = ROLE_DEFAULTS.map((r) => r.name);

// The effective permission set for one user: role permissions, then their
// overrides. Owner short-circuits to everything.
export function effectivePermissions(user, roleRow, overrides = []) {
  if (!user || user.status !== "active") return new Set();
  if (user.role === "owner") return new Set(PERMISSION_KEYS);
  const set = new Set(Array.isArray(roleRow?.permissions) ? roleRow.permissions : []);
  for (const override of overrides) {
    if (override.granted) set.add(override.permission);
    else set.delete(override.permission);
  }
  return set;
}

export function can(permissions, key) {
  return permissions instanceof Set && permissions.has(key);
}

export function sanitizePermissionList(list) {
  if (!Array.isArray(list)) return [];
  const allowed = new Set(PERMISSION_KEYS);
  return [...new Set(list.filter((k) => typeof k === "string" && allowed.has(k)))];
}
