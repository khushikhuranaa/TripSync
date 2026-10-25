import { isEmailConfigured } from "@/server/email";

export const dynamic = "force-dynamic";

/**
 * Public feature flags.
 *
 * Only booleans are exposed. They let the interface say "email delivery is not
 * configured" instead of claiming a reset link was sent when it was not.
 */
export async function GET() {
  return Response.json({ emailConfigured: isEmailConfigured() });
}
