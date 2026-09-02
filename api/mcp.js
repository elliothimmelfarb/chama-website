// /mcp: the Hearth's MCP endpoint (Streamable HTTP transport).
//
// POST carries one JSON-RPC message (or a batch); the answer comes back as
// JSON. GET is not offered (no server-initiated stream is needed), which
// the transport allows. An unauthenticated call is answered with the
// public tools when the owner has switched them on, and with a 401 that
// points at the resource metadata otherwise, which is how a client learns
// where to start the OAuth flow.

import { configured, ready } from "../lib/hearth/db.js";
import { json, requestContext, requestOrigin } from "../lib/hearth/http.js";
import { resolveBearer, handleRpc, useHearthHandler } from "../lib/hearth/mcp.js";
import { handleHearth } from "./hearth.js";
import { sql } from "../lib/hearth/db.js";

useHearthHandler(handleHearth);

function unauthorized(request, description) {
  const origin = requestOrigin(request);
  return json({ error: "unauthorized", error_description: description }, 401, {
    "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"${description ? `, error="invalid_token", error_description="${description}"` : ""}`
  });
}

async function publicOn() {
  const rows = await sql()`select value from settings where key = 'mcp_public'`;
  return rows[0] ? rows[0].value === true : false;
}

export async function handleMcp(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } });
  }
  if (request.method === "GET" || request.method === "DELETE") {
    return new Response(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
  }
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!configured()) return json({ error: "The Hearth is not open yet." }, 503);
  try {
    await ready();
    const context = requestContext(request);
    const header = request.headers.get("authorization");
    let caller = null;
    if (header) {
      caller = await resolveBearer(header);
      if (!caller) return unauthorized(request, "The token is not valid.");
    } else if (!(await publicOn())) {
      return unauthorized(request);
    }
    const text = await request.text();
    if (text.length > 1024 * 1024) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Too large." } }, 413);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }, 400);
    }
    const batch = Array.isArray(body);
    const messages = batch ? body.slice(0, 20) : [body];
    const answers = [];
    for (const message of messages) {
      const answer = await handleRpc(message, { caller, request, context });
      if (answer) answers.push(answer);
    }
    if (!answers.length) return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
    return json(batch ? answers : answers[0], 200, { "MCP-Protocol-Version": "2025-06-18" });
  } catch (error) {
    console.error("MCP request failed", error instanceof Error ? `${error.name}: ${error.message}` : "UnknownError");
    return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Internal error." } }, 500);
  }
}

export default {
  async fetch(request) {
    return await handleMcp(request);
  }
};
