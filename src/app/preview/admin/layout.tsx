import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";

/**
 * The admin area is a server-checked route: a signed-in non-admin is sent back
 * to their dashboard before the page is rendered. The navigation link is hidden
 * as well, but hiding a link is not what protects the page.
 */
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=%2Fpreview%2Fadmin");
  if (user.role !== "admin") redirect("/preview/dashboard");
  return <>{children}</>;
}
