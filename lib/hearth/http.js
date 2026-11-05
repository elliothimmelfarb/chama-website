// Small HTTP helpers shared by every Hearth function.
//
// The same rules as the rest of the domain: cross-site posts are refused by
// origin, nothing a visitor sent is ever logged, and every error the wire
// sees is one short generic sentence.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export function redirect(location, status = 302, headers = {}) {
  return new Response(null, {
    status,
    headers: { Location: location, "Cache-Control": "no-store", ...headers }
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      ...headers
    }
  });
}

// The host the request arrived at, as the browser sees it. Vercel puts the
// public host in x-forwarded-host and overwrites whatever a client sent, and
// it answers an unknown Host with a 404 before any function runs (checked on
// production 2026-11-05), so neither header can be spoofed from outside.
export function requestHost(request) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
}

export function requestOrigin(request) {
  return `https://${requestHost(request)}`;
}

// Same-origin check for anything that writes. A missing Origin (curl, an
// agent with a bearer token) passes: the check is against cross-site browser
// posts, which always carry one.
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === requestHost(request);
  } catch {
    return false;
  }
}

export function readCookie(header, name) {
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return null;
}

export function cookie(name, value, { maxAge, path = "/", sameSite = "Lax", httpOnly = true } = {}) {
  const parts = [`${name}=${value}`, "Secure", `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push("HttpOnly");
  if (typeof maxAge === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join("; ");
}

export async function readJson(request, limitBytes = 256 * 1024) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > limitBytes) throw new HttpError(413, "Too large.");
  const text = await request.text();
  if (text.length > limitBytes) throw new HttpError(413, "Too large.");
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    throw new HttpError(400, "Malformed request.");
  }
}

// What the log is allowed to know about where a request came from: the
// country Vercel resolved, and a device family. Never the address, never the
// raw user agent string.
export function requestContext(request) {
  const country = (request.headers.get("x-vercel-ip-country") || "").slice(0, 2).toUpperCase();
  return { country, device: deviceFamily(request.headers.get("user-agent") || "") };
}

export function deviceFamily(userAgent) {
  const ua = String(userAgent);
  let platform = "Other";
  if (/iPhone|iPad|iPod/.test(ua)) platform = "iOS";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/Macintosh|Mac OS X/.test(ua)) platform = "Mac";
  else if (/Windows/.test(ua)) platform = "Windows";
  else if (/CrOS/.test(ua)) platform = "ChromeOS";
  else if (/Linux/.test(ua)) platform = "Linux";
  let browser = "";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/curl\//i.test(ua)) browser = "curl";
  else if (/python|node|go-http|okhttp|java/i.test(ua)) browser = "script";
  else if (/Claude|Anthropic|MCP/i.test(ua)) browser = "agent";
  if (!ua) return "unknown";
  return browser ? `${browser} on ${platform}` : platform;
}

// A minimal path matcher: "/auth/:provider/callback" against a path, with
// the named segments returned. Wildcards are deliberately not supported.
export function matchPath(pattern, path) {
  const p = pattern.split("/").filter(Boolean);
  const s = path.split("/").filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(":")) {
      params[p[i].slice(1)] = decodeURIComponent(s[i]);
    } else if (p[i] !== s[i]) {
      return null;
    }
  }
  return params;
}

export function isEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

// Every C0 control goes: a newline in a name becomes a header in an email
// subject, and a NUL ends a Postgres string. A field the room treats as
// prose keeps its line breaks with { multiline: true }; nothing else does.
export function clampText(value, max = 2000, { multiline = false } = {}) {
  if (typeof value !== "string") return "";
  const controls = multiline ? /[\u0000-\u0008\u000b-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g;
  return value
    .replace(/\r\n?/g, multiline ? "\n" : " ")
    .replace(controls, "")
    .slice(0, max);
}
