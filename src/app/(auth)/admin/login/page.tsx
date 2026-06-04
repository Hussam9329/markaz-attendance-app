import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const params = await searchParams;

  return (
    <main className="login-page">
      <form className="login-card" action="/api/admin/login" method="post">
        <div className="login-logo">&#9881;</div>
        <h1>مركز أستاذ حسن فلاح</h1>
        <p className="subtitle">أدخل كلمة مرور الإدارة للوصول إلى لوحة التحكم</p>
        {params.error && <div className="alert error">&#10060; كلمة المرور غير صحيحة</div>}
        <div className="form-group">
          <label className="form-label">كلمة المرور</label>
          <input
            className="form-input"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            placeholder="أدخل كلمة المرور"
          />
        </div>
        <button className="btn btn-primary btn-lg" type="submit" style={{ width: "100%" }}>
          دخول لوحة الإدارة
        </button>
      </form>
    </main>
  );
}
