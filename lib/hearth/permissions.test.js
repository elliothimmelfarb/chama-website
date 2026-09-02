import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSION_KEYS,
  ROLE_DEFAULTS,
  can,
  effectivePermissions,
  sanitizePermissionList
} from "./permissions.js";

const clientRole = ROLE_DEFAULTS.find((role) => role.name === "client");
const guestRole = ROLE_DEFAULTS.find((role) => role.name === "guest");

function roleRow(role) {
  return { name: role.name, permissions: role.permissions };
}

test("an owner holds every permission whatever the role row says", () => {
  const permissions = effectivePermissions({ role: "owner", status: "active" }, { permissions: [] });
  assert.deepEqual([...permissions].sort(), [...PERMISSION_KEYS].sort());
});

test("overrides add and remove on top of the role", () => {
  const permissions = effectivePermissions({ role: "client", status: "active" }, roleRow(clientRole), [
    { permission: "metrics.read", granted: true },
    { permission: "feed.read.clients", granted: false }
  ]);
  assert.equal(can(permissions, "metrics.read"), true);
  assert.equal(can(permissions, "feed.read.clients"), false);
  assert.equal(can(permissions, "hearth.enter"), true);
});

test("a suspended user holds nothing", () => {
  const permissions = effectivePermissions({ role: "owner", status: "suspended" }, roleRow(clientRole), [
    { permission: "metrics.read", granted: true }
  ]);
  assert.equal(permissions.size, 0);
  assert.equal(effectivePermissions(null, roleRow(clientRole)).size, 0);
});

test("an unknown role starts empty and still takes its overrides", () => {
  const permissions = effectivePermissions({ role: "ghost", status: "active" }, undefined, [
    { permission: "feed.read", granted: true }
  ]);
  assert.deepEqual([...permissions], ["feed.read"]);
});

test("sanitizePermissionList keeps only known keys, once each", () => {
  assert.deepEqual(sanitizePermissionList(["feed.read", "feed.read", "nonsense.key", 7, null]), ["feed.read"]);
  assert.deepEqual(sanitizePermissionList("feed.read"), []);
  assert.deepEqual(sanitizePermissionList(undefined), []);
});

test("every default role is built from real permissions", () => {
  const known = new Set(PERMISSION_KEYS);
  for (const role of ROLE_DEFAULTS) {
    for (const key of role.permissions) {
      assert.ok(known.has(key), `${role.name} asks for unknown permission ${key}`);
    }
  }
});

test("a guest cannot book and a client owns their transcripts", () => {
  const guest = effectivePermissions({ role: "guest", status: "active" }, roleRow(guestRole));
  const client = effectivePermissions({ role: "client", status: "active" }, roleRow(clientRole));
  assert.equal(can(guest, "sessions.own"), false);
  assert.equal(can(guest, "hearth.enter"), true);
  assert.equal(can(client, "transcripts.own"), true);
  assert.equal(can(client, "members.manage"), false);
  assert.equal(can(["hearth.enter"], "hearth.enter"), false);
});
