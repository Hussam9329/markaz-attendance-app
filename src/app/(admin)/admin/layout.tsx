import AdminNav from "@/components/AdminNav";
import AdminTopbar from "@/components/AdminTopbar";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="admin-shell">
      <AdminNav />
      <div className="admin-main-panel">
        <AdminTopbar />
        <section className="admin-content">{children}</section>
      </div>
    </main>
  );
}
