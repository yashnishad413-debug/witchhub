// notify-owner: emails the site owner when a client creates a request or sends a message.
//
// Called by two Supabase Database Webhooks (INSERT on public.requests and public.messages).
// Sends the email through Resend. Nothing secret is stored in this file.
//
// Secrets (set with `supabase secrets set`, see README "Email notifications"):
//   RESEND_API_KEY   Resend API key (starts with re_)
//   NOTIFY_EMAIL     the address that receives the notifications
//   WEBHOOK_SECRET   a long random string; the webhook must send it in the x-webhook-secret header
// Optional secrets:
//   NOTIFY_FROM      sender, e.g. "Rumii <hello@yourdomain.com>" (needs a domain verified in Resend)
//   SITE_URL         where the admin link in the email points (default below)
//
// Supabase adds SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to every Edge Function by itself.
// They are only used here, on the server, to look up the client's name for a message.
// They are never sent to the browser.

type Json = Record<string, unknown>;

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: Json | null;
}

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Rumii Notifications <onboarding@resend.dev>";
const DEFAULT_SITE_URL = "https://cappybara.netlify.app";
const FETCH_TIMEOUT_MS = 3500;

// ---------- small helpers ----------

function reply(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Turn anything from the database into a plain string (never throws). */
function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Client-written text goes into an HTML email, so always escape it. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function clip(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Subjects must be a single line. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Compare two strings without leaking where they differ. */
function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

function looksLikeEmail(s: string): boolean {
  return s.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s);
}

// ---------- optional lookups (best effort: the email is still sent if these fail) ----------

async function restGet(path: string): Promise<unknown> {
  const base = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) return null;
  try {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Turn svc="canopy", tier=1 into "Canopy" and "Pro" using the published site content. */
async function serviceLabels(svc: string, tier: unknown): Promise<{ service: string; plan: string }> {
  const fallback = { service: svc, plan: "" };
  if (!svc) return fallback;
  const rows = await restGet("site_content?id=eq.main&select=data");
  if (!Array.isArray(rows) || !rows[0]) return fallback;
  const services = ((rows[0] as Json).data as Json | undefined)?.services;
  if (!Array.isArray(services)) return fallback;
  const found = (services as Json[]).find((s) => s && s.id === svc);
  if (!found) return fallback;
  const tiers = Array.isArray(found.tiers) ? (found.tiers as Json[]) : [];
  const idx = Number(tier);
  const plan = Number.isInteger(idx) && tiers[idx] ? str(tiers[idx].name) : "";
  return { service: str(found.name) || svc, plan };
}

async function findRequest(id: string): Promise<Json | null> {
  if (!id) return null;
  const rows = await restGet(`requests?id=eq.${encodeURIComponent(id)}&select=id,data`);
  return Array.isArray(rows) && rows[0] ? (rows[0] as Json) : null;
}

// ---------- email building ----------

interface Row {
  label: string;
  value: string;
}

function buildEmail(heading: string, rows: Row[], bodyTitle: string, body: string, adminUrl: string) {
  const shown = rows.filter((r) => r.value);
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1d1a20">` +
    `<h2 style="margin:0 0 16px;font-size:20px">${esc(heading)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
    shown
      .map((r) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6672;vertical-align:top;white-space:nowrap">${esc(r.label)}</td>` +
        `<td style="padding:6px 0">${esc(r.value)}</td></tr>`
      )
      .join("") +
    `</table>` +
    `<p style="margin:20px 0 6px;color:#6b6672;font-size:13px">${esc(bodyTitle)}</p>` +
    `<div style="white-space:pre-wrap;background:#f6f4f8;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.5">${esc(body)}</div>` +
    `<p style="margin:24px 0 0"><a href="${esc(adminUrl)}" style="background:#1d1a20;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-size:14px">Open admin</a></p>` +
    `</div>`;
  const text =
    `${heading}\n\n` +
    shown.map((r) => `${r.label}: ${r.value}`).join("\n") +
    `\n\n${bodyTitle}:\n${body}\n\nOpen admin: ${adminUrl}\n`;
  return { html, text };
}

// ---------- the function ----------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return reply({ error: "Use POST" }, 405);

  // 1. Only our own webhook may call this (the site's public key is not enough).
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("WEBHOOK_SECRET is not set. Run: supabase secrets set WEBHOOK_SECRET=...");
    return reply({ error: "Server is not configured" }, 500);
  }
  if (!safeEqual(req.headers.get("x-webhook-secret") ?? "", webhookSecret)) {
    return reply({ error: "Unauthorized" }, 401);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const notifyEmail = Deno.env.get("NOTIFY_EMAIL");
  if (!resendKey || !notifyEmail) {
    console.error("RESEND_API_KEY or NOTIFY_EMAIL is not set. Run: supabase secrets set ...");
    return reply({ error: "Server is not configured" }, 500);
  }

  // 2. Read the webhook body.
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return reply({ error: "Body must be JSON" }, 400);
  }
  const rec = payload.record;
  if (payload.type !== "INSERT" || payload.schema !== "public" || !rec) {
    return reply({ ok: true, skipped: "not an insert on public" });
  }

  const siteUrl = (Deno.env.get("SITE_URL") || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const adminUrl = `${siteUrl}/#/admin`;

  // 3. Build the email for a new request or a new client message.
  let subject = "";
  let built: { html: string; text: string };
  let replyTo = "";

  if (payload.table === "requests") {
    const d = (rec.data && typeof rec.data === "object" ? rec.data : {}) as Json;
    const name = clip(str(d.name) || "A client", 80);
    const email = str(d.email);
    const { service, plan } = await serviceLabels(str(d.svc), d.tier);
    subject = oneLine(`New request from ${name}${service ? " - " + clip(service, 60) : ""}`);
    replyTo = email;
    built = buildEmail(
      "New project request",
      [
        { label: "Client", value: name },
        { label: "Email", value: email },
        { label: "Service", value: service },
        { label: "Plan", value: plan },
        { label: "Budget", value: str(d.budget) },
        { label: "Deadline", value: str(d.deadline) },
      ],
      "Brief",
      clip(str(d.brief) || "(no brief)", 4000),
      adminUrl,
    );
  } else if (payload.table === "messages") {
    // Your own replies are also inserted into public.messages. Do not email yourself about them.
    if (rec.from_admin === true) return reply({ ok: true, skipped: "admin reply" });
    const request = await findRequest(str(rec.request_id));
    const d = (request?.data && typeof request.data === "object" ? request.data : {}) as Json;
    const name = clip(str(d.name) || "A client", 80);
    const email = str(d.email);
    const { service } = await serviceLabels(str(d.svc), d.tier);
    subject = oneLine(`New message from ${name}`);
    replyTo = email;
    built = buildEmail(
      "New message from a client",
      [
        { label: "Client", value: name },
        { label: "Email", value: email },
        { label: "Service", value: service },
        { label: "Request", value: str(rec.request_id) },
      ],
      "Message",
      clip(str(rec.text) || "(empty message)", 4000),
      adminUrl,
    );
  } else {
    return reply({ ok: true, skipped: `table ${String(payload.table)} is not handled` });
  }

  // 4. Send it with Resend.
  let res: Response;
  try {
    res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("NOTIFY_FROM") || DEFAULT_FROM,
        to: [notifyEmail],
        subject,
        html: built.html,
        text: built.text,
        ...(looksLikeEmail(replyTo) ? { reply_to: [replyTo] } : {}),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Could not reach Resend:", err instanceof Error ? err.message : String(err));
    return reply({ error: "Could not reach the email provider" }, 502);
  }

  if (!res.ok) {
    // Typical causes: 403 (NOTIFY_EMAIL is not your Resend sign-up email), 401 (bad API key), 429 (daily limit).
    console.error("Resend rejected the email:", res.status, clip(await res.text(), 300));
    return reply({ error: "The email provider rejected the request", status: res.status }, 502);
  }

  return reply({ ok: true });
});
