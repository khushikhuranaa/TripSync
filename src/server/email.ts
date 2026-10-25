import { getBindings } from "./db";

/**
 * Transactional email sender.
 *
 * The app works without email configured: invitations fall back to secure
 * share links, and password reset shows an explicit "email is not configured"
 * message instead of pretending something was sent.
 *
 * Two providers are supported, chosen with `EMAIL_PROVIDER`:
 *
 * - `resend` (default) — needs `RESEND_API_KEY` and a **domain verified in
 *   Resend**, because Resend only sends from a domain you own.
 * - `brevo` — needs `BREVO_API_KEY` and only a **verified sender address**
 *   (Brevo mails a 6-digit code to it), so it works without owning a domain.
 *
 * Both send the same plain-text message; nothing else in the app changes.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

/** Shared sign-off so every message the app sends is recognisably TripSync. */
export const emailSignOff = "\n\n— TripSync";

type EmailProvider = "resend" | "brevo";

/** Reads the provider name; anything unrecognised falls back to Resend. */
function provider(): EmailProvider {
  return getBindings().EMAIL_PROVIDER?.trim().toLowerCase() === "brevo"
    ? "brevo"
    : "resend";
}

export function isEmailConfigured() {
  const env = getBindings();
  if (!env.EMAIL_FROM) return false;
  return provider() === "brevo"
    ? Boolean(env.BREVO_API_KEY)
    : Boolean(env.RESEND_API_KEY);
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Email delivery is not configured. Set EMAIL_FROM plus RESEND_API_KEY (with a verified domain) or BREVO_API_KEY (with a verified sender) as server secrets to send email.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

/**
 * Splits `Name <address@example.com>` into its parts. Brevo wants the sender
 * as an object; Resend accepts the combined string as-is.
 */
function parseSender(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].replace(/^"|"$/g, ""), email: match[2].trim() };
  }
  return { name: "TripSync", email: from.trim() };
}

/**
 * The provider endpoint must be HTTPS, because the API key travels in a
 * header. Plain HTTP is tolerated only for a loopback address during local
 * development, where a capture server stands in for the provider.
 */
function endpointFor(kind: EmailProvider) {
  const env = getBindings();
  const fallback =
    kind === "brevo" ? "https://api.brevo.com/v3" : "https://api.resend.com";
  const rawBase = (env.EMAIL_API_BASE ?? fallback).trim().replace(/\/+$/, "");
  const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(
    rawBase,
  );
  if (!/^https:\/\//i.test(rawBase) && !isLoopback) {
    throw new Error(
      "EMAIL_API_BASE must be an https:// URL (http:// is accepted only for localhost during development).",
    );
  }
  return rawBase;
}

/** Builds the one HTTP request each provider expects for a plain-text email. */
function requestFor(
  kind: EmailProvider,
  base: string,
  message: EmailMessage,
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const env = getBindings();
  const sender = parseSender(env.EMAIL_FROM ?? "");

  if (kind === "brevo") {
    return {
      url: `${base}/smtp/email`,
      headers: {
        "api-key": env.BREVO_API_KEY ?? "",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: {
        sender,
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
      },
    };
  }

  return {
    url: `${base}/emails`,
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY ?? ""}`,
      "Content-Type": "application/json",
    },
    body: {
      from: env.EMAIL_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    },
  };
}

export async function sendEmail({ to, subject, text }: EmailMessage) {
  if (!isEmailConfigured()) {
    throw new EmailNotConfiguredError();
  }
  const kind = provider();
  const base = endpointFor(kind);
  const request = requestFor(kind, base, { to, subject, text });

  // A provider that never answers must not hold a sign-up or a resend request
  // open indefinitely: eight seconds, then the caller reports the failure.
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(8000),
  }).catch((error: unknown) => {
    throw new Error(
      `Email provider could not be reached: ${error instanceof Error ? error.name : "network error"}.`,
    );
  });

  if (!response.ok) {
    // Never log the key or the recipient's message body.
    throw new Error(`Email provider rejected the message (${response.status}).`);
  }
}
