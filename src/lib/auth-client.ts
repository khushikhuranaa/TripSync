"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Browser-side Better Auth client.
 *
 * It only calls this app's own `/api/auth` routes. No secret is present here:
 * the session lives in an HTTP-only cookie that JavaScript cannot read.
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [twoFactorClient()],
});

/** Turns a Better Auth error into a sentence a person can act on. */
export function authErrorMessage(
  error: { message?: string; status?: number; code?: string } | null | undefined,
  fallback: string,
) {
  if (!error) return fallback;

  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();

  if (error.status === 429 || code.includes("RATE_LIMIT")) {
    return "Too many attempts in a short time. Wait a minute and try again.";
  }
  // Check credentials before the email-format branch: Better Auth reports a
  // wrong password as `INVALID_EMAIL_OR_PASSWORD`, which must not be mistaken
  // for a malformed address.
  if (
    code === "INVALID_EMAIL_OR_PASSWORD" ||
    code.includes("INVALID_CREDENTIALS") ||
    code.includes("INVALID_PASSWORD") ||
    message.includes("invalid email or password") ||
    message.includes("invalid password") ||
    message.includes("invalid credentials")
  ) {
    return "That email and password do not match an account.";
  }
  if (code === "INVALID_EMAIL" || message.includes("invalid email")) {
    return "Enter an email address in the form name@example.com.";
  }
  if (
    code.includes("USER_ALREADY_EXISTS") ||
    message.includes("already exists") ||
    message.includes("user already")
  ) {
    return "An account with that email already exists. Sign in instead.";
  }
  if (message.includes("password") && message.includes("8")) {
    return "Use at least 8 characters for the password.";
  }
  if (
    code.includes("TWO_FACTOR") ||
    message.includes("two factor") ||
    message.includes("2fa") ||
    message.includes("totp")
  ) {
    return "That code is not correct. Check your authenticator app and try again, or use a recovery code.";
  }
  if (
    code.includes("EMAIL_NOT_VERIFIED") ||
    message.includes("email not verified") ||
    message.includes("verify your email")
  ) {
    return "Confirm your email address before signing in. Check your inbox for the link.";
  }
  if (code.includes("INVALID_TOKEN") || message.includes("token")) {
    return "That link is invalid or has expired. Request a new one.";
  }
  return fallback;
}
