/**
 * Type declarations for the bindings this project reads from the Worker
 * environment. Values marked optional are configuration the app checks for at
 * runtime and reports honestly when missing; they are never invented.
 */
declare global {
  interface CloudflareEnv {
    DB: D1Database;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    AI_PROVIDER?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
    AI_API_KEY?: string;
    /** Optional: provider response timeout in ms (1s–120s; default 45s). */
    AI_TIMEOUT_MS?: string;
    /** Optional: generation attempts per user per10 minutes (default6). */
    AI_MAX_ATTEMPTS?: string;
    EMAIL_PROVIDER?: string;
    RESEND_API_KEY?: string;
    /** Brevo transactional API key. Use with EMAIL_PROVIDER=brevo, which needs
     * only a verified sender address (no domain). */
    BREVO_API_KEY?: string;
    EMAIL_FROM?: string;
    /** Optional: provider endpoint override for development (https, or http for
     * loopback only). Defaults to https://api.resend.com. */
    EMAIL_API_BASE?: string;
    ADMIN_EMAIL?: string;
    /** Google OAuth client for Sign in with Google (Google Cloud → Credentials).
     * Both must be set together; the Google button stays hidden otherwise.
     * Authorized redirect URI: <origin>/api/auth/callback/google */
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}

export {};
