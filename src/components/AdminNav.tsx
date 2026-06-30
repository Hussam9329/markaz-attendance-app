"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "الرئيسية", icon: "🏠" },
  { href: "/admin/employees", label: "الموظفون", icon: "👥" },
  { href: "/admin/attendance", label: "الحضور والغياب", icon: "📋" },
  { href: "/admin/salaries", label: "الرواتب", icon: "💰" },
  { href: "/admin/reports", label: "التقارير", icon: "📊" },
  { href: "/admin/settings", label: "الإعدادات", icon: "⚙️" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-header">
        <div className="logo-row">
          <div className="sidebar-logo-img">
            <Image src="/logo.png" alt="الطاقم TheCrew" width={42} height={42} />
          </div>
          <div>
            <h2>الطاقم <span className="logo-en">TheCrew</span></h2>
            <span className="tag">حضور · رواتب · إدارة</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}>
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link href="/scan" target="_blank" className="btn" style={{ marginBottom: "8px" }}>
          <span className="nav-icon">📱</span>
          واجهة مسح QR
        </Link>
        <form action="/api/admin/logout" method="post">
          <button className="btn" type="submit">
            <span className="nav-icon">🚪</span>
            تسجيل خروج
          </button>
        </form>
      </div>
    </aside>
  );
}
