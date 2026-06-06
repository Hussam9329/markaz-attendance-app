import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const params = await searchParams;

  return (
    <main className="login-page">
      <form className="login-card" action="/api/admin/login" method="post">
        <div className="login-logo-wrapper">
          <Image src="/logo.png" alt="الطاقم TheCrew" width={80} height={80} className="login-logo-img" />
        </div>
        <h1>الطاقم <span className="logo-en-hero">TheCrew</span></h1>
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
