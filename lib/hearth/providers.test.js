import assert from "node:assert/strict";
import crypto from "node:crypto";
import test, { beforeEach } from "node:test";

import { resetJwksCache } from "../../api/admin-auth.js";
import {
  availableProviders,
  discordAuthorizeUrl,
  discordExchange,
  githubAuthorizeUrl,
  githubExchange,
  verifyGoogleIdToken
} from "./providers.js";

const CLIENT_ID = "123456.apps.googleusercontent.com";
const NOW_MS = Date.UTC(2026, 8, 2, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);

const keyPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicJwk = { ...keyPair.publicKey.export({ format: "jwk" }), kid: "hearth-test", alg: "RS256", use: "sig" };
const otherPair = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function makeToken(claims = {}, { privateKey = keyPair.privateKey, header = {} } = {}) {
  const fullHeader = { alg: "RS256", kid: "hearth-test", typ: "JWT", ...header };
  const fullClaims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    exp: NOW_SECONDS + 3600,
    email: "Someone@Example.com",
    email_verified: true,
    name: "Someone",
    picture: "https://lh3.googleusercontent.com/a/photo",
    ...claims
  };
  const signingInput = `${base64url(JSON.stringify(fullHeader))}.${base64url(JSON.stringify(fullClaims))}`;
  if (fullHeader.alg === "none") return `${signingInput}.`;
  return `${signingInput}.${crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url")}`;
}

function jwksFetch(keys = [publicJwk]) {
  return async () => ({ ok: true, headers: { get: () => null }, json: async () => ({ keys }) });
}

function deps(overrides = {}) {
  return { clientId: CLIENT_ID, now: () => NOW_MS, fetch: jwksFetch(), ...overrides };
}

// Each response in order; anything past the end is a refusal, so a test that
// makes an unexpected call fails rather than reaching the network.
function sequenceFetch(responses) {
  const seen = [];
  const fetch = async (url, options) => {
    seen.push({ url, options });
    const next = responses[seen.length - 1];
    if (!next) return { ok: false, json: async () => ({}) };
    return { ok: next.ok !== false, json: async () => next.body };
  };
  fetch.seen = seen;
  return fetch;
}

beforeEach(() => {
  resetJwksCache();
});

test("availableProviders follows what the env actually holds", () => {
  assert.deepEqual(availableProviders({}), { google: null, github: false, discord: false, email: true });
  assert.deepEqual(
    availableProviders({
      GOOGLE_CLIENT_ID: ` ${CLIENT_ID} `,
      GITHUB_CLIENT_ID: "gh-id",
      DISCORD_CLIENT_ID: "dc-id",
      DISCORD_CLIENT_SECRET: "dc-secret"
    }),
    { google: CLIENT_ID, github: false, discord: true, email: true }
  );
  assert.equal(availableProviders({ GITHUB_CLIENT_ID: "gh-id", GITHUB_CLIENT_SECRET: "gh-secret" }).github, true);
});

test("a properly signed Google token becomes an identity", async () => {
  const result = await verifyGoogleIdToken(makeToken(), deps());
  assert.deepEqual(result, {
    ok: true,
    identity: {
      provider: "google",
      providerId: "google-sub-1",
      email: "someone@example.com",
      name: "Someone",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo"
    }
  });
});

test("Google tokens are refused for every reason they should be", async () => {
  assert.deepEqual(await verifyGoogleIdToken("not-a-jwt", deps()), { ok: false, reason: "malformed" });
  assert.deepEqual(await verifyGoogleIdToken(undefined, deps()), { ok: false, reason: "malformed" });
  assert.deepEqual(await verifyGoogleIdToken("x".repeat(9000), deps()), { ok: false, reason: "malformed" });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({}, { header: { alg: "none" } }), deps()), {
    ok: false,
    reason: "malformed"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({}, { privateKey: otherPair.privateKey }), deps()), {
    ok: false,
    reason: "signature"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({ iss: "https://evil.example.com" }), deps()), {
    ok: false,
    reason: "issuer"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({ aud: "someone-else" }), deps()), {
    ok: false,
    reason: "audience"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({ exp: NOW_SECONDS - 1 }), deps()), {
    ok: false,
    reason: "expired"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken({ email_verified: false }), deps()), {
    ok: false,
    reason: "unverified"
  });
  assert.deepEqual(await verifyGoogleIdToken(makeToken(), deps({ clientId: "" })), {
    ok: false,
    reason: "unconfigured"
  });
});

test("the authorize urls carry the client, the redirect, the state and the scopes", () => {
  const args = { clientId: "gh-id", redirectUri: "https://chamainteligente.com/api/hearth/auth/github/callback", state: "nonce" };
  const github = new URL(githubAuthorizeUrl(args));
  assert.equal(github.origin + github.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(github.searchParams.get("client_id"), "gh-id");
  assert.equal(github.searchParams.get("redirect_uri"), args.redirectUri);
  assert.equal(github.searchParams.get("state"), "nonce");
  assert.equal(github.searchParams.get("scope"), "read:user user:email");

  const discord = new URL(discordAuthorizeUrl({ ...args, clientId: "dc-id" }));
  assert.equal(discord.origin + discord.pathname, "https://discord.com/oauth2/authorize");
  assert.equal(discord.searchParams.get("client_id"), "dc-id");
  assert.equal(discord.searchParams.get("redirect_uri"), args.redirectUri);
  assert.equal(discord.searchParams.get("state"), "nonce");
  assert.equal(discord.searchParams.get("scope"), "identify email");
  assert.equal(discord.searchParams.get("response_type"), "code");
});

const githubConfig = { config: { clientId: "gh-id", clientSecret: "gh-secret" } };

test("githubExchange takes the primary verified address", async () => {
  const fetch = sequenceFetch([
    { body: { access_token: "gh-token" } },
    { body: { id: 4242, login: "someone", name: "Someone", avatar_url: "https://avatars.githubusercontent.com/u/4242" } },
    {
      body: [
        { email: "old@example.com", primary: false, verified: true },
        { email: "Someone@Example.com", primary: true, verified: true }
      ]
    }
  ]);
  const result = await githubExchange({ code: "code", redirectUri: "https://x.test/cb" }, { fetch, ...githubConfig });
  assert.deepEqual(result, {
    ok: true,
    identity: {
      provider: "github",
      providerId: "4242",
      email: "someone@example.com",
      name: "Someone",
      avatarUrl: "https://avatars.githubusercontent.com/u/4242"
    }
  });
});

test("githubExchange refuses without a verified address or a token", async () => {
  const unverified = sequenceFetch([
    { body: { access_token: "gh-token" } },
    { body: { id: 4242, login: "someone" } },
    { body: [{ email: "someone@example.com", primary: true, verified: false }] }
  ]);
  assert.deepEqual(await githubExchange({ code: "c", redirectUri: "https://x.test/cb" }, { fetch: unverified, ...githubConfig }), {
    ok: false,
    reason: "unverified"
  });

  const refused = sequenceFetch([{ ok: false, body: { error: "bad_verification_code" } }]);
  assert.deepEqual(await githubExchange({ code: "c", redirectUri: "https://x.test/cb" }, { fetch: refused, ...githubConfig }), {
    ok: false,
    reason: "exchange"
  });
});

const discordConfig = { config: { clientId: "dc-id", clientSecret: "dc-secret" } };

test("discordExchange accepts a verified account and refuses anything less", async () => {
  const ok = sequenceFetch([
    { body: { access_token: "dc-token" } },
    { body: { id: "77", username: "someone", global_name: "Someone", email: "Someone@Example.com", verified: true, avatar: "hash" } }
  ]);
  assert.deepEqual(await discordExchange({ code: "c", redirectUri: "https://x.test/cb" }, { fetch: ok, ...discordConfig }), {
    ok: true,
    identity: {
      provider: "discord",
      providerId: "77",
      email: "someone@example.com",
      name: "Someone",
      avatarUrl: "https://cdn.discordapp.com/avatars/77/hash.png?size=128"
    }
  });

  const unverified = sequenceFetch([
    { body: { access_token: "dc-token" } },
    { body: { id: "77", username: "someone", email: "someone@example.com", verified: false } }
  ]);
  assert.deepEqual(
    await discordExchange({ code: "c", redirectUri: "https://x.test/cb" }, { fetch: unverified, ...discordConfig }),
    { ok: false, reason: "unverified" }
  );

  const refused = sequenceFetch([{ ok: false, body: {} }]);
  assert.deepEqual(await discordExchange({ code: "c", redirectUri: "https://x.test/cb" }, { fetch: refused, ...discordConfig }), {
    ok: false,
    reason: "exchange"
  });
});
