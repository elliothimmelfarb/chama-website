// Google Meet as the meeting room.
//
// Elliot connects his Google account once (owner only, code flow with
// offline access). From then on every booking becomes a Calendar event on
// his calendar with a Meet room, the client invited; after the meeting the
// cron asks the Meet API for the conference record and its transcript, and
// the record is written from that, no upload step. The paste and file
// intake stays as the fallback.
//
// The refresh token is the one secret this creates. It is stored in the
// settings table encrypted with HEARTH_SESSION_SECRET (AES-256-GCM), never
// logged, never returned by any endpoint. Access tokens live in memory for
// their hour.

import crypto from "node:crypto";
import { sql } from "./db.js";
import { randomToken } from "./auth.js";

export const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.readonly"
];

const SETTING_KEY = "google_connection";

export function googleConfig(env = process.env) {
  const read = (k) => (typeof env[k] === "string" ? env[k].trim() : "");
  const clientId = read("GOOGLE_CLIENT_ID");
  const clientSecret = read("GOOGLE_CLIENT_SECRET");
  const secret = read("HEARTH_SESSION_SECRET");
  return { clientId, clientSecret, secret, configured: Boolean(clientId && clientSecret && secret.length >= 32) };
}

/* ---------- the one secret ---------- */

function key(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

export function seal(plain, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${body.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}`;
}

export function open(sealed, secret) {
  const parts = String(sealed || "").split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(secret), Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ---------- the connection ---------- */

export async function readConnection() {
  const rows = await sql()`select value from settings where key = ${SETTING_KEY}`;
  return rows[0] ? rows[0].value : null;
}

export async function connectionStatus() {
  const c = await readConnection();
  const config = googleConfig();
  return {
    configured: config.configured,
    connected: Boolean(c && c.refresh),
    email: c ? c.email : null,
    connectedAt: c ? c.connectedAt : null,
    scopes: c ? c.scopes : [],
    calendarId: c ? c.calendarId || "primary" : "primary"
  };
}

export function authorizeUrl({ redirectUri, state }) {
  const { clientId } = googleConfig();
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(" "));
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

export async function issueConnectState(userId) {
  const state = randomToken(24);
  await sql()`insert into oauth_states (state, provider, expires_at, meta) values (${state}, 'google-connect', ${new Date(Date.now() + 10 * 60000).toISOString()}, ${JSON.stringify({ userId })}::jsonb)`;
  return state;
}

export async function consumeConnectState(state) {
  if (typeof state !== "string" || state.length > 128) return null;
  const rows = await sql()`delete from oauth_states where state = ${state} and provider = 'google-connect' and expires_at > now() returning meta`;
  return rows[0] ? rows[0].meta : null;
}

function decodeJwtEmail(idToken) {
  try {
    const claims = JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8"));
    return typeof claims.email === "string" ? claims.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

// The code from the consent redirect becomes a refresh token, sealed and
// stored with the account's email so the settings page can say whose it is.
export async function finishConnect({ code, redirectUri }, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, ...dependencies };
  const config = googleConfig();
  if (!config.configured) return { ok: false, reason: "unconfigured" };
  const response = await deps.fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" })
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || typeof token.refresh_token !== "string") return { ok: false, reason: "exchange" };
  const granted = typeof token.scope === "string" ? token.scope.split(" ") : [];
  const email = decodeJwtEmail(token.id_token);
  const value = { email, refresh: seal(token.refresh_token, config.secret), scopes: granted, connectedAt: new Date().toISOString(), calendarId: "primary" };
  await sql()`
    insert into settings (key, value) values (${SETTING_KEY}, ${JSON.stringify(value)}::jsonb)
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  accessCache = null;
  return { ok: true, email, scopes: granted };
}

export async function disconnect() {
  await sql()`delete from settings where key = ${SETTING_KEY}`;
  accessCache = null;
}

let accessCache = null;

export async function accessToken(dependencies = {}) {
  const deps = { fetch: globalThis.fetch, now: () => Date.now(), ...dependencies };
  if (accessCache && accessCache.expiresAt > deps.now() + 60000) return accessCache.token;
  const config = googleConfig();
  const c = await readConnection();
  if (!config.configured || !c || !c.refresh) throw new Error("GoogleNotConnected");
  const refresh = open(c.refresh, config.secret);
  if (!refresh) throw new Error("GoogleTokenUnreadable");
  const response = await deps.fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refresh, client_id: config.clientId, client_secret: config.clientSecret, grant_type: "refresh_token" })
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || typeof token.access_token !== "string") {
    console.error("Google token refresh failed", response.status, typeof token.error === "string" ? token.error : "");
    throw new Error("GoogleRefreshFailed");
  }
  accessCache = { token: token.access_token, expiresAt: deps.now() + (Number(token.expires_in) || 3600) * 1000 };
  return accessCache.token;
}

async function call(method, url, body, dependencies = {}) {
  const deps = { fetch: globalThis.fetch, ...dependencies };
  const token = await accessToken(deps);
  const response = await deps.fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.status === 204) return {};
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Google${method}Failed`);
    error.status = response.status;
    error.detail = data?.error?.message || "";
    throw error;
  }
  return data;
}

/* ---------- Calendar: an event with a Meet room ---------- */

export async function isConnected() {
  const c = await readConnection();
  return Boolean(googleConfig().configured && c && c.refresh);
}

export async function createMeeting({ bookingId, startsAt, endsAt, clientEmail, clientName, title, description }, dependencies = {}) {
  const c = await readConnection();
  const calendarId = encodeURIComponent(c?.calendarId || "primary");
  const event = await call("POST", `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`, {
    summary: title || `Session: ${clientName || clientEmail}`,
    description: description || "Booked in the Hearth. https://chamainteligente.com/hearth/sessions",
    start: { dateTime: new Date(startsAt).toISOString() },
    end: { dateTime: new Date(endsAt).toISOString() },
    attendees: clientEmail ? [{ email: clientEmail, displayName: clientName || undefined }] : [],
    conferenceData: { createRequest: { requestId: `hearth-${bookingId}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    extendedProperties: { private: { hearthBookingId: bookingId } },
    reminders: { useDefault: true }
  }, dependencies);
  const meetUrl = event.hangoutLink || (event.conferenceData?.entryPoints || []).find((e) => e.entryPointType === "video")?.uri || null;
  const code = event.conferenceData?.conferenceId || (meetUrl ? meetUrl.replace(/^https:\/\/meet\.google\.com\//, "") : null);
  return { eventId: event.id, meetUrl, meetingCode: code };
}

export async function moveMeeting({ eventId, startsAt, endsAt }, dependencies = {}) {
  const c = await readConnection();
  const calendarId = encodeURIComponent(c?.calendarId || "primary");
  await call("PATCH", `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    start: { dateTime: new Date(startsAt).toISOString() },
    end: { dateTime: new Date(endsAt).toISOString() }
  }, dependencies);
}

export async function cancelMeeting({ eventId }, dependencies = {}) {
  const c = await readConnection();
  const calendarId = encodeURIComponent(c?.calendarId || "primary");
  try {
    await call("DELETE", `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, null, dependencies);
  } catch (error) {
    if (error.status !== 404 && error.status !== 410) throw error;
  }
}

/* ---------- Meet: the transcript after the meeting ---------- */

// Finds the conference record for a meeting code and, if its transcript has
// finished, returns the entries as "Name: text" lines. Returns null while
// nothing is ready yet (the meeting has not happened, or Meet is still
// writing the transcript), so the caller simply tries again later.
export async function fetchTranscript({ meetingCode }, dependencies = {}) {
  if (!meetingCode) return null;
  const filter = encodeURIComponent(`space.meeting_code = "${meetingCode}"`);
  const records = await call("GET", `https://meet.googleapis.com/v2/conferenceRecords?filter=${filter}`, null, dependencies);
  const list = Array.isArray(records.conferenceRecords) ? records.conferenceRecords : [];
  if (!list.length) return null;
  // Several conference records can exist for one code (a re-join makes a
  // new one); take the most recent that has ended.
  const ended = list.filter((r) => r.endTime).sort((a, b) => new Date(b.endTime) - new Date(a.endTime));
  for (const record of ended) {
    const transcripts = await call("GET", `https://meet.googleapis.com/v2/${record.name}/transcripts`, null, dependencies);
    const ready = (transcripts.transcripts || []).find((t) => t.state === "FILE_GENERATED" || t.state === "ENDED");
    if (!ready) continue;
    const participants = {};
    let pageToken = "";
    do {
      const page = await call("GET", `https://meet.googleapis.com/v2/${record.name}/participants?pageSize=100${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, null, dependencies);
      for (const p of page.participants || []) {
        participants[p.name] = p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || "Speaker";
      }
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    const lines = [];
    pageToken = "";
    let lastSpeaker = null;
    do {
      const page = await call("GET", `https://meet.googleapis.com/v2/${ready.name}/entries?pageSize=1000${pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : ""}`, null, dependencies);
      for (const e of page.transcriptEntries || []) {
        const speaker = participants[e.participant] || "Speaker";
        const text = String(e.text || "").trim();
        if (!text) continue;
        if (speaker === lastSpeaker && lines.length) lines[lines.length - 1] += " " + text;
        else { lines.push(`${speaker}: ${text}`); lastSpeaker = speaker; }
      }
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    if (!lines.length) continue;
    return { text: lines.join("\n"), recordName: record.name, startTime: record.startTime, endTime: record.endTime, participants: Object.values(participants) };
  }
  return null;
}
