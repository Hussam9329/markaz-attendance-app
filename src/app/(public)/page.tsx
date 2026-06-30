import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const params = await searchParams;

  return (
    <main className="login-page index-login-page">
      <form className="login-card index-login-card" action="/api/admin/login" method="post">
        <div className="login-logo-wrapper">
          <Image src="/logo.png" alt="الطاقم TheCrew" width={80} height={80} className="login-logo-img" priority />
        </div>
        <div className="login-copy">
          <span className="login-kicker">TheCrew Admin</span>
          <h1>تسجيل الدخول</h1>
          <p className="subtitle">ادخل كلمة مرور الإدارة للوصول إلى لوحة التحكم، الحضور، الرواتب، والتقارير.</p>
        </div>
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
          <span className="form-help">الصفحة الرئيسية الآن مخصصة لتسجيل الدخول، وتسجيل الحضور لم يعد يظهر كواجهة أولى.</span>
        </div>
        <button className="btn btn-primary btn-lg" type="submit">
          دخول لوحة الإدارة
        </button>
      </form>
    </main>
  );
}
