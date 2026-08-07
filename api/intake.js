import { put } from "@vercel/blob";

const LIMITS = {
  name: 120,
  email: 254,
  whatsappNumber: 50,
  request: 4000
};

function clean(value) {
  if (typeof value !== "string") return "";
  return value.replaceAll("\u0000", "").trim();
}

function wantsJson(request) {
  return request.headers.get("accept")?.includes("application/json") ?? false;
}

function response(request, body, status = 200) {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": wantsJson(request)
      ? "application/json; charset=utf-8"
      : "text/plain; charset=utf-8"
  };

  return new Response(
    wantsJson(request) ? JSON.stringify(body) : body.error || "Submission received.",
    { status, headers }
  );
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const submittedHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    const requestHost = forwardedHost || new URL(request.url).host;
    return submittedHost === requestHost;
  } catch {
    return false;
  }
}

async function readFields(request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await request.json();
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export function validate(fields) {
  const submission = {
    name: clean(fields.name),
    email: clean(fields.email).toLowerCase(),
    whatsappNumber: clean(fields.whatsappNumber),
    request: clean(fields.request)
  };

  if (!submission.name || !submission.email || !submission.request) {
    return { error: "Please include your name, email, and what you would like to understand, decide, or make." };
  }

  for (const [field, limit] of Object.entries(LIMITS)) {
    if (submission[field].length > limit) {
      return { error: "One of your answers is too long. Please shorten it and try again." };
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) {
    return { error: "Please enter a valid email address." };
  }

  return { submission };
}

export function buildRecord(submission, submittedAt) {
  return {
    schemaVersion: 2,
    submittedAt,
    source: "chamainteligente.com",
    ...submission
  };
}

function looksAutomated(fields) {
  if (clean(fields.company)) return true;

  const startedAt = Number(fields.startedAt);
  return Number.isFinite(startedAt) && startedAt > 0 && Date.now() - startedAt < 1000;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("Method not allowed.", {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" }
      });
    }

    if (!isSameOrigin(request)) {
      return response(request, { error: "This submission could not be accepted." }, 403);
    }

    let fields;
    try {
      fields = await readFields(request);
    } catch {
      return response(request, { error: "The form could not be read. Please try again." }, 400);
    }

    if (looksAutomated(fields)) {
      return response(request, { ok: true });
    }

    const result = validate(fields);
    if (result.error) {
      return response(request, { error: result.error }, 400);
    }

    const submittedAt = new Date().toISOString();
    const day = submittedAt.slice(0, 10);
    const record = buildRecord(result.submission, submittedAt);

    try {
      await put(
        `intake/${day}/submission-${submittedAt.replaceAll(":", "-")}.json`,
        JSON.stringify(record, null, 2),
        {
          access: "private",
          addRandomSuffix: true,
          contentType: "application/json"
        }
      );
    } catch (error) {
      console.error("Intake storage failed", error instanceof Error ? error.name : "UnknownError");
      return response(
        request,
        { error: "Something went wrong and your note was not saved. Please try again." },
        500
      );
    }

    if (wantsJson(request)) {
      return response(request, { ok: true });
    }

    return Response.redirect(new URL("/#thanks", request.url), 303);
  }
};
