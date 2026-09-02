// /api/oauth/*: the authorization server's public endpoints, plus the two
// well-known documents (rewritten here from /.well-known/...).
//
// register  - RFC 7591 dynamic client registration
// authorize - validates the request and sends the person to the consent
//             page in the Hearth (/hearth/authorize?req=...)
// token     - authorization_code (PKCE) and refresh_token grants
// revoke    - RFC 7009
// metadata, resource - the discovery documents

import { configured, ready } from "../lib/hearth/db.js";
import { json, redirect, requestOrigin, matchPath } from "../lib/hearth/http.js";
import { allow, addressKey } from "../lib/hearth/auth.js";
import { metadata, resourceMetadata, registerClient, startAuthorization, exchangeCode, refreshTokens, revokeToken } from "../lib/hearth/oauth.js";
import { audit, EVENTS } from "../lib/hearth/audit.js";
import { requestContext } from "../lib/hearth/http.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version"
};

function resolvePath(request) {
  const url = new URL(request.url);
  let path = url.pathname.startsWith("/api/oauth") ? url.pathname.slice("/api/oauth".length) : "";
  if (url.pathname === "/.well-known/oauth-authorization-server") path = "/metadata";
  if (url.pathname === "/.well-known/oauth-protected-resource") path = "/resource";
  if (!path || path === "/") {
    const segments = url.searchParams.getAll("path");
    if (segments.length) path = "/" + segments.join("/");
  }
  return { url, path: path || "/" };
}

// Token and revoke accept form bodies (the standard) and JSON (a courtesy);
// client credentials may also arrive as HTTP Basic.
async function readParams(request) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  const text = await request.text();
  const out = {};
  if (type.includes("application/json")) {
    try {
      Object.assign(out, JSON.parse(text || "{}"));
    } catch {
      return out;
    }
  } else {
    new URLSearchParams(text).forEach((v, k) => { out[k] = v; });
  }
  const auth = request.headers.get("authorization") || "";
  const basic = /^Basic\s+(.+)$/i.exec(auth);
  if (basic) {
    try {
      const [id, secret] = Buffer.from(basic[1], "base64").toString("utf8").split(":");
      if (id && !out.client_id) out.client_id = decodeURIComponent(id);
      if (secret && !out.client_secret) out.client_secret = decodeURIComponent(secret);
    } catch {
      /* not basic after all */
    }
  }
  return out;
}

function oauthError(body, status = 400) {
  return json(body, status, { ...CORS, Pragma: "no-cache" });
}

export async function handleOauth(request) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const { url, path } = resolvePath(request);
  const origin = requestOrigin(request);
  if (path === "/metadata") return json(metadata(origin), 200, { ...CORS, "Cache-Control": "public, max-age=3600" });
  if (path === "/resource") return json(resourceMetadata(origin), 200, { ...CORS, "Cache-Control": "public, max-age=3600" });
  if (!configured()) return oauthError({ error: "temporarily_unavailable" }, 503);
  try {
    await ready();
    const context = requestContext(request);

    if (path === "/register" && request.method === "POST") {
      if (!(await allow(`oauth:register:${addressKey(request)}`, 20, 3600))) return oauthError({ error: "too_many_requests" }, 429);
      const body = await readParams(request);
      const result = await registerClient(body);
      if (result.error) return oauthError(result, 400);
      await audit({ event: EVENTS.oauthClientRegistered, actorKind: "public", target: result.client_id, meta: { name: result.client_name }, ...context });
      return json(result, 201, CORS);
    }

    if (path === "/authorize" && request.method === "GET") {
      const params = {};
      url.searchParams.forEach((v, k) => { params[k] = v; });
      const result = await startAuthorization(params);
      if (result.redirect) return redirect(result.redirect);
      if (result.error) return json({ error: result.error, error_description: result.description }, 400);
      return redirect(`${origin}/hearth/authorize?req=${encodeURIComponent(result.requestId)}`);
    }

    if (path === "/token" && request.method === "POST") {
      if (!(await allow(`oauth:token:${addressKey(request)}`, 120, 900))) return oauthError({ error: "too_many_requests" }, 429);
      const body = await readParams(request);
      let result;
      if (body.grant_type === "authorization_code") {
        result = await exchangeCode({ code: body.code, redirectUri: body.redirect_uri, clientId: body.client_id, clientSecret: body.client_secret, codeVerifier: body.code_verifier });
      } else if (body.grant_type === "refresh_token") {
        result = await refreshTokens({ refreshToken: body.refresh_token, clientId: body.client_id, clientSecret: body.client_secret, scope: body.scope });
      } else {
        return oauthError({ error: "unsupported_grant_type" });
      }
      if (result.error) return oauthError(result, result.error === "invalid_client" ? 401 : 400);
      return json(result, 200, { ...CORS, Pragma: "no-cache" });
    }

    if (path === "/revoke" && request.method === "POST") {
      const body = await readParams(request);
      const ok = await revokeToken({ token: body.token, clientId: body.client_id, clientSecret: body.client_secret });
      if (!ok) return oauthError({ error: "invalid_client" }, 401);
      return new Response(null, { status: 200, headers: { ...CORS, "Cache-Control": "no-store" } });
    }

    void matchPath;
    return json({ error: "not_found" }, 404, CORS);
  } catch (error) {
    console.error("OAuth request failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return oauthError({ error: "server_error" }, 500);
  }
}

export default {
  async fetch(request) {
    return await handleOauth(request);
  }
};
