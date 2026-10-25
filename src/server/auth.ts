import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { getBindings, getDb } from "./db";
import { ensureMigrated } from "./migrations";
import { isEmailConfigured, emailSignOff, sendEmail } from "./email";
import {
  account,
  session,
  twoFactor as twoFactorTable,
  user,
  verification,
} from "./schema";

/**
 * Authentication is handled by Better Auth.
 *
 * Better Auth owns password hashing (scrypt), session tokens, TOTP secrets and
 * the `user`/`session`/`account`/`verification`/`two_factor` tables. This file
 * only supplies configuration. It never sees, stores or logs a plaintext
 * password, a TOTP secret or a backup code.
 */

const DEV_SECRET = "tripsync-local-development-secret-change-in-production";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "user" | "admin";
  homeCity: string;
  travelStyle: "Relaxed" | "Balanced" | "Packed";
  dietaryNotes: string;
  createdAt: Date;
  /** Set by the two-factor plugin. Drives the account-security card. */
  twoFactorEnabled?: boolean;
};

function authOptions(): BetterAuthOptions {
  const env = getBindings();
  const isProduction = process.env.NODE_ENV === "production";
  const baseURL =
    env.BETTER_AUTH_URL ?? (isProduction ? undefined : "http://localhost:3000");
  // Email verification is only enforced when a provider can actually deliver
  // the message. Without a provider, requiring it would lock every new account
  // out of the product with no way to finish — so it stays off and the UI says
  // plainly that verification mail is unavailable.
  const emailConfigured = isEmailConfigured();
  // Sign in with Google is only registered when this deployment actually has
  // OAuth credentials, so a half-configured site never exposes a button (or
  // an endpoint) that cannot complete a flow. Google-delivered accounts
  // arrive with an already-verified address, so they are exempt from the
  // confirmation email that password sign-ups need. Better Auth reads these
  // from the top-level `socialProviders` option — that is what registers the
  // provider with /api/auth/sign-in/social.
  const googleClientId = env.GOOGLE_CLIENT_ID;
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

  // A published deployment must never fall back to the committed dev secret:
  // anyone who has read this file could forge session cookies. Fail loudly and
  // tell the operator which server variables to set instead.
  if (isProduction && (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL)) {
    throw new Error(
      "BETTER_AUTH_SECRET and BETTER_AUTH_URL must be set as server secrets in production. " +
        "Generate the secret with `openssl rand -base64 32` and set the URL to the exact public origin.",
    );
  }

  return {
    appName: "TripSync",
    secret: env.BETTER_AUTH_SECRET ?? DEV_SECRET,
    baseURL,
    basePath: "/api/auth",
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
      schema: { user, session, account, verification, twoFactor: twoFactorTable },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: emailConfigured,
      // Seconds. The reset email promises "one hour", so the token lifetime is
      // stated here explicitly instead of relying on a library default.
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({
        user: targetUser,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => {
        await sendEmail({
          to: targetUser.email,
          subject: "Reset your TripSync password",
          text: [
            `Hello ${targetUser.name},`,
            "",
            "Use the link below to choose a new TripSync password. It expires in one hour and can be used once.",
            "",
            url,
            "",
            "If you did not ask for this, you can ignore this message.",
            emailSignOff,
          ].join("\n"),
        });
      },
    },
    emailVerification: {
      // One hour, single use: the token row is consumed when it is accepted.
      expiresIn: 60 * 60,
      autoSignInAfterVerification: true,
      sendOnSignUp: emailConfigured,
      sendVerificationEmail: async ({
        user: targetUser,
        url,
      }: {
        user: { email: string; name: string };
        url: string;
      }) => {
        if (!isEmailConfigured()) return;
        await sendEmail({
          to: targetUser.email,
          subject: "Confirm your TripSync email",
          text: [
            `Hello ${targetUser.name},`,
            "",
            "Confirm this address to finish setting up your TripSync account. The link expires in one hour and works once.",
            "",
            url,
            "",
            "If you did not create this account, ignore this message.",
            emailSignOff,
          ].join("\n"),
        });
      },
    },
    user: {
      additionalFields: {
        // `input: false` keeps the role out of every public sign-up payload.
        role: {
          type: "string",
          required: false,
          defaultValue: "user",
          input: false,
        },
        homeCity: {
          type: "string",
          required: false,
          defaultValue: "",
          input: true,
        },
        travelStyle: {
          type: "string",
          required: false,
          defaultValue: "Balanced",
          input: true,
        },
        dietaryNotes: {
          type: "string",
          required: false,
          defaultValue: "",
          input: true,
        },
      },
    },
    socialProviders: {
      ...(googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
        : {}),
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24 * 7,
      // Cookies stay HTTP-only (Better Auth default); the session row is always
      // re-read from D1, so deleting a session ends access immediately.
    },
    plugins: [
      twoFactor({
        issuer: "TripSync",
        // Ten hashed one-time recovery codes, generated at enrolment.
        backupCodeOptions: { amount: 10, length: 10 },
        // Five wrong codes lock the challenge for 15 minutes; a success resets
        // the counter. This stops an attacker with the password from simply
        // guessing 6-digit codes.
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 5,
          durationSeconds: 900,
        },
        twoFactorCookieMaxAge: 600,
      }),
    ],
    advanced: {
      database: { generateId: () => crypto.randomUUID() },
      // Cloudflare sets this header; x-forwarded-for is the local-dev fallback.
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
    },
    trustedOrigins: [
      // Local origins are for development only; a published site must not
      // treat requests from a local page as same-site.
      ...(isProduction ? [] : ["http://localhost:3000", "http://localhost:3100"]),
      ...(env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : []),
    ],
    rateLimit: {
      enabled: true,
      storage: "memory",
      window: 60,
      max: 60,
      customRules: {
        // Credential guessing, signup spam, verification-email spam and OTP
        // brute force each get their own tighter budget than the global limit.
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 600, max: 10 },
        "/send-verification-email": { window: 300, max: 3 },
        "/verify-email": { window: 300, max: 10 },
        "/forget-password": { window: 900, max: 3 },
        "/reset-password": { window: 900, max: 5 },
        "/two-factor/verify-totp": { window: 300, max: 10 },
        "/two-factor/verify-backup-code": { window: 300, max: 10 },
        "/two-factor/enable": { window: 300, max: 10 },
        "/change-password": { window: 900, max: 5 },
      },
    },
  };
}

let cached: { db: D1Database; auth: ReturnType<typeof betterAuth> } | null =
  null;

export function getAuth() {
  const db = getBindings().DB;
  if (!db) {
    throw new Error("The D1 binding named DB is missing.");
  }
  if (!cached || cached.db !== db) {
    cached = { db, auth: betterAuth(authOptions()) };
  }
  return cached.auth;
}

/** Reads the signed-in user on the server, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  // Every server page and action starts here, so this is the choke point that
  // guarantees the schema exists before any query runs (once per isolate).
  await ensureMigrated(getBindings().DB);
  const { headers } = await import("next/headers");
  const session = await getAuth().api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  const record = session.user as unknown as SessionUser;
  return {
    ...record,
    emailVerified: Boolean(record.emailVerified),
    twoFactorEnabled: Boolean(record.twoFactorEnabled),
    role: record.role === "admin" ? "admin" : "user",
    travelStyle:
      record.travelStyle === "Relaxed" || record.travelStyle === "Packed"
        ? record.travelStyle
        : "Balanced",
  };
}

/**
 * True when this deployment can actually send email. Pages use it to decide
 * whether "unverified accounts are blocked" is a real rule (it is, when mail
 * works) or a disabled one that must be explained instead.
 */
export function isVerificationEnforced() {
  return isEmailConfigured();
}

/**
 * True when this deployment can offer Sign in with Google. The sign-in and
 * sign-up pages use it so the Google button only appears when it works; a
 * missing pair of credentials hides the button instead of dead-ending.
 */
export function isGoogleConfigured() {
  const env = getBindings();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
