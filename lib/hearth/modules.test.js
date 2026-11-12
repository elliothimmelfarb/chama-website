import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

import { ROOM_MODULES, roomModulesFor } from "./modules.js";
import { PERMISSION_KEYS, ROLE_DEFAULTS } from "./permissions.js";

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "assets");

function roleSet(name) {
  return new Set(ROLE_DEFAULTS.find((role) => role.name === name).permissions);
}

const BUSINESS = ["hearth-admin", "hearth-sessions-admin", "hearth-transcripts-admin"];

test("a guest loads the parts every member uses, the feed and agents, and nothing of the business", () => {
  assert.deepEqual(roomModulesFor(roleSet("guest")), ["hearth-sessions", "hearth-agents", "hearth-feed"]);
});

test("a client loads their own sessions and records but no part of the business", () => {
  const modules = roomModulesFor(roleSet("client"));
  assert.deepEqual(modules, ["hearth-sessions", "hearth-transcripts", "hearth-remember", "hearth-agents", "hearth-feed", "hearth-ask"]);
  for (const name of BUSINESS) assert.equal(modules.includes(name), false, name);
});

test("the owner loads every part, in the order the parts register", () => {
  assert.deepEqual(roomModulesFor(new Set(PERMISSION_KEYS)), ROOM_MODULES.map((m) => m.name));
});

test("one business permission is enough to load the part that holds it", () => {
  assert.deepEqual(roomModulesFor(new Set(["availability.manage"])), ["hearth-sessions", "hearth-sessions-admin"]);
  assert.deepEqual(roomModulesFor(new Set(["audit.read"])), ["hearth-admin", "hearth-sessions"]);
});

test("no permissions, or none given, still loads only what every member has", () => {
  assert.deepEqual(roomModulesFor(new Set()), ["hearth-sessions"]);
  assert.deepEqual(roomModulesFor(undefined), ["hearth-sessions"]);
});

/* ---------- the list matches the files ----------

   Each part of the room is run against a stand-in window.Hearth that
   records what it registers. A route or a home tile that opens for a
   permission its part is not loaded for would vanish for that member, so
   every one is checked against the list. */

function loadPart(name) {
  const routes = [];
  const homes = [];
  const held = { set: new Set() };
  const calls = [];
  const noop = () => {};
  const H = new Proxy({
    register: (pattern, view, options = {}) => routes.push({ pattern, perm: options.perm || null }),
    onHome: (fn) => homes.push(fn),
    can: (key) => held.set.has(key),
    api: (p) => { calls.push(p); return new Promise(noop); },
    state: { user: { id: "u", timezone: "UTC" }, invoices: 0 },
    BASE: "/hearth"
  }, {
    get: (target, key) => (key in target ? target[key] : noop)
  });
  const window = { Hearth: H, matchMedia: () => ({ matches: false }) };
  const context = vm.createContext({
    window,
    document: { addEventListener: noop },
    location: { pathname: "/hearth", search: "" },
    history: { replaceState: noop },
    URLSearchParams,
    console
  });
  vm.runInContext(fs.readFileSync(path.join(ASSETS, name + ".js"), "utf8"), context, { filename: name + ".js" });
  return { routes, homes, held, calls };
}

test("every part of the room in assets is on the list, and nothing else is", () => {
  const files = fs.readdirSync(ASSETS)
    .filter((f) => /^hearth-.+\.js$/.test(f))
    .map((f) => f.slice(0, -3))
    .sort();
  assert.deepEqual(ROOM_MODULES.map((m) => m.name).sort(), files);
});

test("hearth-room.html has an address for every part on the list, and for nothing else", () => {
  const html = fs.readFileSync(path.join(ASSETS, "..", "hearth-room.html"), "utf8");
  const named = [...html.matchAll(/"\/assets\/(hearth-[a-z-]+)\.js(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ROOM_MODULES.map((m) => m.name).sort());
});

for (const part of ROOM_MODULES) {
  test(`${part.name}: every room it registers opens only for a permission that loads it`, () => {
    const { routes } = loadPart(part.name);
    assert.ok(routes.length > 0, "registers at least one room");
    for (const route of routes) {
      if (part.always) continue;
      assert.ok(route.perm, `${route.pattern} has no permission, so ${part.name} must load for everyone`);
      assert.ok(part.any.includes(route.perm), `${route.pattern} needs ${route.perm}, which does not load ${part.name}`);
    }
  });

  if (part.always) continue;
  test(`${part.name}: its home tiles stay empty for someone it does not load for`, async () => {
    const loaded = loadPart(part.name);
    loaded.held.set = new Set(PERMISSION_KEYS.filter((key) => !part.any.includes(key)));
    let tiles = 0;
    for (const hook of loaded.homes) {
      try {
        await Promise.race([hook(() => { tiles += 1; return {}; }, {}), Promise.resolve()]);
      } catch { /* a hook that throws on stand-in data still shows what it called */ }
    }
    assert.deepEqual(loaded.calls, []);
    assert.equal(tiles, 0);
  });
}
