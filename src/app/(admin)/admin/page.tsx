import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth, getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getDaySummary, getRecentAttendance } from "@/lib/attendance";
import { getMonthlySalaryReport } from "@/lib/report";

export const dynamic = "force-dynamic";

function num(v: unknown) { return Number(v ?? 0).toLocaleString("ar-IQ"); }
function money(v: unknown) { return Number(v ?? 0).toLocaleString("ar-IQ"); }

export default async function AdminHomePage() {
  const settings = await getSettings();
  const today = getLocalParts(new Date(), settings.timezone).date;
  const month = currentMonth(settings.timezone);

  let totalEmployees = 0, activeEmployees = 0, departments = 0;
  let todaySummary = { total_records: 0, present_count: 0, late_count: 0, total_late_minutes: 0, total_deductions: 0 };
  let absentToday = 0;
  let recentRecords: Awaited<ReturnType<typeof getRecentAttendance>> = [];
  let monthlyPayroll: Awaited<ReturnType<typeof getMonthlySalaryReport>> = [];

  try {
    const db = getDb();
    const empRows = await db`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE active = true)::int AS active,
        COUNT(DISTINCT NULLIF(department, ''))::int AS departments
      FROM employees
    `;
    const empData = (empRows as Record<string, unknown>[])[0];
    totalEmployees = Number(empData?.total ?? 0);
    activeEmployees = Number(empData?.active ?? 0);
    departments = Number(empData?.departments ?? 0);

    todaySummary = await getDaySummary(today);
    absentToday = (await getAbsentEmployeesByDate(today)).length;
    recentRecords = await getRecentAttendance(10);
    monthlyPayroll = await getMonthlySalaryReport(month);
  } catch {
    // DB not ready
  }

  const payrollTotals = monthlyPayroll.reduce(
    (acc, row) => ({
      gross: acc.gross + row.gross_salary,
      deductions: acc.deductions + row.total_deductions,
      net: acc.net + row.net_salary,
      absentDays: acc.absentDays + row.absent_days,
    }),
    { gross: 0, deductions: 0, net: 0, absentDays: 0 }
  );

  const attendanceRate = activeEmployees > 0 ? Math.round((todaySummary.total_records / activeEmployees) * 100) : 0;
  const todayFormatted = new Date().toLocaleDateString("ar-IQ", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: settings.timezone,
  });

  return (
    <div className="stack">
      <header className="page-header hero-admin-header">
        <div>
          <div className="page-tag">&#9670; الطاقم TheCrew</div>
          <h1>نظام إدارة الحضور والرواتب</h1>
          <p>{settings.center_name} — {todayFormatted}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <a className="btn btn-accent" href="/" target="_blank">📱 واجهة مسح QR</a>
          <a className="btn btn-secondary" href="/admin/reports">📊 مركز التقارير</a>
        </div>
      </header>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">👥</div>
          <span className="stat-label">الموظفون الفعالون / الكلي</span>
          <strong className="stat-value">{num(activeEmployees)} / {num(totalEmployees)}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">📈</div>
          <span className="stat-label">نسبة حضور اليوم</span>
          <strong className="stat-value">{num(attendanceRate)}%</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">⏰</div>
          <span className="stat-label">متأخرون اليوم</span>
          <strong className="stat-value">{num(todaySummary.late_count)}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>🚫</div>
          <span className="stat-label">غائبون اليوم</span>
          <strong className="stat-value">{num(absentToday)}</strong>
        </article>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">🏢</div>
          <span className="stat-label">الأقسام</span>
          <strong className="stat-value">{num(departments)}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">💵</div>
          <span className="stat-label">إجمالي المستحق الشهري</span>
          <strong className="stat-value">{money(payrollTotals.gross)} {settings.currency}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>📉</div>
          <span className="stat-label">خصومات الشهر</span>
          <strong className="stat-value" style={{ color: "var(--error)" }}>{money(payrollTotals.deductions)} {settings.currency}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">✅</div>
          <span className="stat-label">صافي الرواتب</span>
          <strong className="stat-value" style={{ color: "var(--success)" }}>{money(payrollTotals.net)} {settings.currency}</strong>
        </article>
      </section>

      <section className="steps-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <a href="/admin/employees" className="step-card action-card">
          <div className="step-number" style={{ background: "var(--primary-50)", color: "var(--primary)" }}>👥</div>
          <div className="step-text"><strong>ملفات الموظفين</strong><span>كود، قسم، وظيفة، هاتف، راتب، مخصصات، وQR</span></div>
        </a>
        <a href="/admin/attendance" className="step-card action-card">
          <div className="step-number" style={{ background: "var(--success-bg)", color: "var(--success)" }}>📋</div>
          <div className="step-text"><strong>الحضور والغياب</strong><span>حاضرين، متأخرين، غائبين، ونسبة الحضور اليومية</span></div>
        </a>
        <a href="/admin/salaries" className="step-card action-card">
          <div className="step-number" style={{ background: "var(--accent-light)", color: "var(--accent-dark)" }}>💰</div>
          <div className="step-text"><strong>الرواتب</strong><span>مستحقات، خصومات تأخير وغياب، وصافي الراتب</span></div>
        </a>
        <a href="/admin/reports" className="step-card action-card">
          <div className="step-number" style={{ background: "var(--info-bg)", color: "var(--info)" }}>📊</div>
          <div className="step-text"><strong>التقارير</strong><span>تصدير CSV ومراجعة الأداء المالي والإداري</span></div>
        </a>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>📋 آخر سجلات الحضور</h2>
            <p>آخر عمليات QR المسجلة في النظام.</p>
          </div>
          <a href="/admin/attendance" className="btn btn-ghost btn-sm">عرض الكل ←</a>
        </div>

        {recentRecords.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>📋</div>
            <h3 style={{ fontSize: "16px" }}>لا توجد سجلات حضور بعد</h3>
            <p style={{ fontSize: "13px" }}>سيظهر هنا سجل الحضور فور تسجيل أول حضور.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الموظف</th>
                  <th>القسم</th>
                  <th>الوظيفة</th>
                  <th>التاريخ</th>
                  <th>الوقت</th>
                  <th>الحالة</th>
                  <th>التأخير</th>
                  <th>الخصم</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>
                      <a href={`/admin/employees/${r.employee_id}`} style={{ color: "var(--primary)" }}>{r.employee_name}</a>
                    </td>
                    <td>{r.department || "—"}</td>
                    <td>{r.job_title || "—"}</td>
                    <td>{r.local_date}</td>
                    <td>{r.local_time}</td>
                    <td><span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>{r.status === "present" ? "✅ حاضر" : "⏰ متأخر"}</span></td>
                    <td>{r.late_minutes > 0 ? `${r.late_minutes} دقيقة` : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
