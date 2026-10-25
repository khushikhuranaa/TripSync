import { isEmailConfigured } from "@/server/email";
import { isGoogleConfigured } from "@/server/auth";

export const dynamic = "force-dynamic";

/**
 * Public feature flags.
 *
 * Only booleans are exposed. They let the interface say "email delivery is not
 * configured" instead of claiming a reset link was sent when it was not, and
 * show the Google button only when OAuth credentials exist.
 */
export async function GET() {
  return Response.json({
    emailConfigured: isEmailConfigured(),
    googleConfigured: isGoogleConfigured(),
  });
}
