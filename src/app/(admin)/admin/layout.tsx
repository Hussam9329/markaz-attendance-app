import AdminNav from "@/components/AdminNav";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <AdminNav />
      <section className="admin-content">{children}</section>
    </main>
  );
}
