// Connecting Elliot's Google account, for Calendar and Meet.
//
// Owner only. GET /admin/google says whether it is configured and
// connected; GET /admin/google/connect sends the owner to Google's consent
// (offline access, so a refresh token comes back); GET /google/callback
// finishes it and returns to Settings; DELETE /admin/google forgets the
// connection.

import { HttpError, json, redirect, requestOrigin } from "../http.js";
import { auditor } from "../audit.js";
import { googleConfig, connectionStatus, authorizeUrl, issueConnectState, consumeConnectState, finishConnect, disconnect } from "../google.js";

export const GOOGLE_EVENTS = { connected: "google.connected", disconnected: "google.disconnected", meetingFailed: "google.meeting_failed", transcriptPulled: "google.transcript_pulled" };

function callbackUrl(request) {
  return `${requestOrigin(request)}/api/hearth/google/callback`;
}

export function registerGoogleRoutes({ route, needs }) {
  route("GET", "/admin/google", async (context) => {
    needs(context, "settings.manage");
    return json({ ...(await connectionStatus()), callbackUrl: callbackUrl(context.request) });
  });

  route("GET", "/admin/google/connect", async (context) => {
    needs(context, "settings.manage");
    if (context.actor.user.role !== "owner") throw new HttpError(403, "Only the owner connects the company's Google account.");
    if (!googleConfig().configured) throw new HttpError(503, "GOOGLE_CLIENT_SECRET is not set in Vercel yet.");
    const state = await issueConnectState(context.actor.user.id);
    return redirect(authorizeUrl({ redirectUri: callbackUrl(context.request), state }));
  });

  route("GET", "/google/callback", async (context) => {
    const url = new URL(context.request.url);
    const meta = await consumeConnectState(url.searchParams.get("state"));
    const code = url.searchParams.get("code");
    const back = (q) => redirect(`/hearth/admin/settings?google=${q}`);
    if (!meta || !code) return back("failed");
    if (!context.actor || context.actor.user.id !== meta.userId || context.actor.user.role !== "owner") return back("failed");
    const result = await finishConnect({ code, redirectUri: callbackUrl(context.request) });
    if (!result.ok) {
      console.warn("Google connect failed", result.reason);
      return back("failed");
    }
    await auditor(context, context.actor.user)(GOOGLE_EVENTS.connected, null, { email: result.email, scopes: result.scopes });
    return back("connected");
  });

  route("DELETE", "/admin/google", async (context) => {
    needs(context, "settings.manage");
    if (context.actor.user.role !== "owner") throw new HttpError(403, "Only the owner disconnects it.");
    await disconnect();
    await auditor(context, context.actor.user)(GOOGLE_EVENTS.disconnected, null);
    return json({ ok: true });
  });
}
