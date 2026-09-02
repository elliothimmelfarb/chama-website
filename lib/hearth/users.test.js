import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { useClient } from "./db.js";
import { fakeDb } from "./test-helpers.js";
import {
  adminEmails,
  createUser,
  loadActor,
  promoteIfAdmin,
  publicUser,
  referralCode,
  userForIdentity
} from "./users.js";

const ADMIN = "elliot@chamainteligente.com";
const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (ORIGINAL_ADMIN_EMAILS === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS;
});

function userRow(overrides = {}) {
  return {
    id: "user-1",
    email: "someone@example.com",
    name: "Someone",
    avatar_url: null,
    role: "guest",
    status: "active",
    timezone: "Europe/Lisbon",
    referral_code: "abcd2345",
    created_at: "2026-09-01T10:00:00.000Z",
    last_seen_at: null,
    email_verified_at: "2026-09-01T10:00:00.000Z",
    notes: "a private note",
    password_hash: "scrypt$never$leaves",
    referred_by: null,
    ...overrides
  };
}

// The insert echoes back the row it was given, so a test can see the role.
function insertedUser(call) {
  return [userRow({ id: "new-user", email: call.values[0], name: call.values[1], role: call.values[3] })];
}

test("adminEmails is a trimmed lowercase list", () => {
  assert.deepEqual(adminEmails({ ADMIN_EMAILS: ` ${ADMIN.toUpperCase()} , other@example.com , ` }), [
    ADMIN,
    "other@example.com"
  ]);
  assert.deepEqual(adminEmails({}), []);
});

test("referralCode is eight characters with no look-alikes", () => {
  for (let i = 0; i < 50; i += 1) {
    assert.match(referralCode(), /^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
  }
  assert.notEqual(referralCode(), referralCode());
});

test("createUser makes an owner only for an address on the admin list", async () => {
  process.env.ADMIN_EMAILS = ADMIN;

  const first = fakeDb([[/insert into users/, insertedUser]]);
  useClient(first);
  assert.equal((await createUser({ email: ` ${ADMIN.toUpperCase()} ` })).role, "owner");

  const second = fakeDb([[/insert into users/, insertedUser]]);
  useClient(second);
  const guest = await createUser({ email: "stranger@example.com" });
  assert.equal(guest.role, "guest");
  assert.equal(second.matching(/insert into users/)[0].values[0], "stranger@example.com");
});

test("a known identity signs its user in without creating anything", async () => {
  process.env.ADMIN_EMAILS = "";
  const db = fakeDb([[/from identities i join users u/, [userRow()]]]);
  useClient(db);

  const { user, created } = await userForIdentity({
    provider: "github",
    providerId: "42",
    email: "someone@example.com",
    name: "Someone"
  });
  assert.equal(created, false);
  assert.equal(user.id, "user-1");
  assert.equal(db.count(/insert into users/), 0);
  assert.equal(db.count(/insert into identities/), 0);
});

test("an unknown identity for a known email links instead of creating a user", async () => {
  process.env.ADMIN_EMAILS = "";
  const db = fakeDb([
    [/from identities i join users u/, []],
    [/select \* from users where email/, [userRow()]]
  ]);
  useClient(db);

  const { user, created } = await userForIdentity({
    provider: "discord",
    providerId: "abc",
    email: "someone@example.com",
    name: "Someone"
  });
  assert.equal(created, false);
  assert.equal(user.id, "user-1");
  assert.equal(db.count(/insert into users/), 0);
  assert.deepEqual(db.matching(/insert into identities/)[0].values, [
    "user-1",
    "discord",
    "abc",
    "someone@example.com"
  ]);
});

test("an unknown identity for an unknown email creates the user", async () => {
  process.env.ADMIN_EMAILS = "";
  const db = fakeDb([
    [/from identities i join users u/, []],
    [/select \* from users where email/, []],
    [/insert into users/, insertedUser]
  ]);
  useClient(db);

  const { user, created } = await userForIdentity({
    provider: "google",
    providerId: "sub-1",
    email: "New@Example.com",
    name: "New Person"
  });
  assert.equal(created, true);
  assert.equal(user.email, "new@example.com");
  assert.equal(db.count(/insert into identities/), 1);
});

test("anyone on the admin list is promoted on sign-in", async () => {
  process.env.ADMIN_EMAILS = ADMIN;
  const db = fakeDb();
  useClient(db);

  const promoted = await promoteIfAdmin(userRow({ email: ADMIN, role: "guest" }));
  assert.equal(promoted.role, "owner");
  assert.equal(db.count(/update users set role = 'owner'/), 1);

  const untouched = await promoteIfAdmin(userRow({ role: "client" }));
  assert.equal(untouched.role, "client");
  assert.equal(db.count(/update users set role = 'owner'/), 1);
});

test("publicUser hands over nothing private", () => {
  const view = publicUser(userRow(), new Set(["hearth.enter"]));
  assert.deepEqual(Object.keys(view).sort(), [
    "avatarUrl", "createdAt", "email", "emailVerified", "id", "lastSeenAt",
    "name", "permissions", "referralCode", "role", "status", "timezone"
  ]);
  assert.equal(view.emailVerified, true);
  assert.deepEqual(view.permissions, ["hearth.enter"]);
  const serialized = JSON.stringify(publicUser(userRow()));
  assert.ok(!serialized.includes("a private note"));
  assert.ok(!serialized.includes("scrypt"));
});

test("loadActor puts the user, their role and their overrides together", async () => {
  process.env.ADMIN_EMAILS = "";
  useClient(
    fakeDb([
      [/select \* from users where id/, [userRow({ role: "client" })]],
      [/select \* from roles where name/, [{ name: "client", label: "Client", permissions: ["hearth.enter", "feed.read"] }]],
      [/from user_permissions/, [{ permission: "metrics.read", granted: true }, { permission: "feed.read", granted: false }]]
    ])
  );

  const actor = await loadActor("user-1");
  assert.equal(actor.user.id, "user-1");
  assert.equal(actor.role.label, "Client");
  assert.deepEqual([...actor.permissions].sort(), ["hearth.enter", "metrics.read"]);

  useClient(fakeDb([[/select \* from users where id/, []]]));
  assert.equal(await loadActor("nobody"), null);
});
