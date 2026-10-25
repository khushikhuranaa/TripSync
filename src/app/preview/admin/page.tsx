import { redirect } from "next/navigation";
import { getSessionUser } from "@/server/auth";
import AdminPageContent from "./admin-page-content";

export const dynamic = "force-dynamic";

/**
 * The admin workspace is checked here, before any client code runs. A normal
 * user is sent back to their dashboard; no admin data or markup is produced.
 * The feedback rows themselves are also only loaded by `loadWorkspace` for
 * accounts whose database role is `admin`.
 */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/preview/dashboard");
  }
  return <AdminPageContent />;
}
