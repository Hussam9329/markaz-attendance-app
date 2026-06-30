"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import FutureRealtimeClock from "@/components/future/FutureRealtimeClock";

const pageNames: Record<string, string> = {
  "/admin": "لوحة التحكم",
  "/admin/employees": "الموظفون",
  "/admin/attendance": "الحضور والغياب",
  "/admin/salaries": "الرواتب",
  "/admin/reports": "التقارير",
  "/admin/settings": "الإعدادات",
};

const searchableSelector = [
  ".employee-card",
  ".activity-card",
  ".absence-decision-card",
  ".salary-review-card",
  ".rank-item",
  ".step-card",
  ".control-card",
  "tbody tr",
].join(",");

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export default function AdminTopbar() {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const pageName = useMemo(() => {
    const matched = Object.keys(pageNames).sort((a, b) => b.length - a.length).find((path) => pathname.startsWith(path));
    return matched ? pageNames[matched] : "لوحة الإدارة";
  }, [pathname]);

  useEffect(() => {
    const normalized = normalize(query);
    const items = Array.from(document.querySelectorAll<HTMLElement>(searchableSelector));
    let shown = 0;

    items.forEach((item) => {
      if (!normalized) {
        item.hidden = false;
        item.classList.remove("lux-filtered-out");
        return;
      }
      const text = normalize(item.innerText || item.textContent || "");
      const visible = text.includes(normalized);
      item.hidden = !visible;
      item.classList.toggle("lux-filtered-out", !visible);
      if (visible) shown += 1;
    });

    document.documentElement.style.setProperty("--lux-live-results", String(shown));

    return () => {
      items.forEach((item) => {
        item.hidden = false;
        item.classList.remove("lux-filtered-out");
      });
    };
  }, [query, pathname]);

  return (
    <header className="admin-topbar">
      <div className="topbar-page-meta">
        <span className="topbar-kicker">TheCrew Future Console</span>
        <strong>{pageName}</strong>
      </div>
      <label className="topbar-search" data-no-magnetic="true">
        <span>⌕</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="بحث مباشر داخل الصفحة بدون Enter..."
          aria-label="بحث مباشر داخل الصفحة"
        />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث">×</button>}
      </label>
      <FutureRealtimeClock />
      <div className="topbar-status-pill">
        <span className="live-dot" />
        <span>متصل بالنظام</span>
      </div>
    </header>
  );
}
