import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth, getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getDaySummary } from "@/lib/attendance";
import { getMonthlySalaryReport } from "@/lib/report";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();
  const today = getLocalParts(new Date(), settings.timezone).date;
  const month = params.month || currentMonth(settings.timezone);
  const date = params.date || today;

  let totalEmployees = 0;
  let activeEmployees = 0;
  let monthlyRows: Awaited<ReturnType<typeof getMonthlySalaryReport>> = [];
  let daySummary = { total_records: 0, present_count: 0, late_count: 0, absent_count: 0, total_late_minutes: 0, total_deductions: 0 };
  let absentToday = 0;

  try {
    const db = getDb();
    const empRows = await db`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE active = true)::int AS active
      FROM employees
    `;
    const emp = (empRows as Record<string, unknown>[])[0];
    totalEmployees = Number(emp?.total ?? 0);
    activeEmployees = Number(emp?.active ?? 0);
    monthlyRows = await getMonthlySalaryReport(month);
    daySummary = await getDaySummary(date);
    absentToday = (await getAbsentEmployeesByDate(date)).length;
  } catch {
    // DB not ready
  }

  const totals = monthlyRows.reduce(
    (acc, row) => ({
      gross: acc.gross + row.gross_salary,
      deductions: acc.deductions + row.total_deductions,
      net: acc.net + row.net_salary,
      lateDays: acc.lateDays + row.late_days,
      absentDays: acc.absentDays + row.absent_days,
      attendanceDays: acc.attendanceDays + row.attendance_days,
    }),
    { gross: 0, deductions: 0, net: 0, lateDays: 0, absentDays: 0, attendanceDays: 0 }
  );

  const dayAttendance = daySummary.present_count + daySummary.late_count;
  const dayTotal = daySummary.total_records + absentToday;
  const dayRate = dayTotal > 0 ? Math.round((dayAttendance / dayTotal) * 100) : 0;
  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-IQ-u-nu-latn", { month: "long", year: "numeric" });
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("ar-IQ-u-nu-latn", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">📊 التقارير</div>
          <h1>مركز التقارير الإدارية والمالية</h1>
          <p>لوحة مراجعة سريعة للحضور والرواتب مع تصدير كشف الرواتب CSV.</p>
        </div>
        <a className="btn btn-accent" href={`/api/reports/monthly.csv?month=${month}`}>📥 تنزيل كشف الرواتب</a>
      </header>

      <section className="ux-guide">
        <div><strong>تقرير يومي</strong><span>يعرض حضور يوم محدد مع المتأخرين والغياب غير المحسوم.</span></div>
        <div><strong>تقرير شهري</strong><span>يعرض الرواتب والخصومات وصافي كل موظف لنفس الشهر.</span></div>
        <div><strong>تصدير CSV</strong><span>استخدمه للأرشفة أو المراجعة المحاسبية خارج النظام.</span></div>
      </section>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">شهر الرواتب</label>
            <input className="form-input" name="month" type="month" defaultValue={month} />
            <span className="form-help">يحدد شهر كشف الرواتب والملخص المالي.</span>
          </div>
          <div className="form-group">
            <label className="form-label">تاريخ الحضور</label>
            <input className="form-input" name="date" type="date" defaultValue={date} />
            <span className="form-help">يحدد يوم الحضور الذي تريد مراجعته.</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>تحديث التقرير</button>
        </form>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">👥</div>
          <span className="stat-label">الموظفون الفعالون / الكلي</span>
          <strong className="stat-value">{activeEmployees.toLocaleString("en-US")} / {totalEmployees.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">📈</div>
          <span className="stat-label">نسبة حضور اليوم</span>
          <strong className="stat-value">{dayRate.toLocaleString("en-US")}%</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">⏰</div>
          <span className="stat-label">أيام التأخير الشهرية</span>
          <strong className="stat-value">{totals.lateDays.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>🚫</div>
          <span className="stat-label">أيام الغياب الشهرية</span>
          <strong className="stat-value">{totals.absentDays.toLocaleString("en-US")}</strong>
        </article>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">💵</div>
          <span className="stat-label">مستحقات {monthLabel}</span>
          <strong className="stat-value">{money(totals.gross)} {settings.currency}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>📉</div>
          <span className="stat-label">خصومات {monthLabel}</span>
          <strong className="stat-value" style={{ color: "var(--error)" }}>{money(totals.deductions)} {settings.currency}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">✅</div>
          <span className="stat-label">صافي رواتب {monthLabel}</span>
          <strong className="stat-value" style={{ color: "var(--success)" }}>{money(totals.net)} {settings.currency}</strong>
        </article>
      </section>

      <section className="steps-grid">
        <a href={`/admin/attendance?date=${date}`} className="step-card action-card">
          <div className="step-number">📋</div>
          <div className="step-text">
            <strong>تقرير الحضور اليومي</strong>
            <span>{dateLabel}: حضور {daySummary.total_records.toLocaleString("en-US")}، تأخير {daySummary.late_count.toLocaleString("en-US")}، غياب مسجل {daySummary.absent_count.toLocaleString("en-US")}، غير محسوم {absentToday.toLocaleString("en-US")}</span>
          </div>
        </a>
        <a href={`/admin/salaries?month=${month}`} className="step-card action-card">
          <div className="step-number">💰</div>
          <div className="step-text">
            <strong>كشف الرواتب الشهري</strong>
            <span>صافي الرواتب: {money(totals.net)} {settings.currency}</span>
          </div>
        </a>
        <a href={`/api/reports/monthly.csv?month=${month}`} className="step-card action-card">
          <div className="step-number">CSV</div>
          <div className="step-text">
            <strong>تصدير كشف الرواتب</strong>
            <span>ملف جاهز للمحاسبة أو الأرشفة.</span>
          </div>
        </a>
        <a href="/admin/settings" className="step-card action-card">
          <div className="step-number">⚙️</div>
          <div className="step-text">
            <strong>قواعد الاحتساب</strong>
            <span>وقت التأخير، مبلغ الخصم لكل دقيقة، وأيام العمل الشهرية.</span>
          </div>
        </a>
      </section>

      <section className="card-elevated table-wrap">
        <div className="section-heading">
          <div>
            <h2>أفضل ملخص للرواتب — {monthLabel}</h2>
            <p>أعلى 10 موظفين حسب صافي الراتب في الكشف الحالي.</p>
          </div>
        </div>
        {monthlyRows.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px" }}>
            <div className="empty-icon">📊</div>
            <h3>لا توجد بيانات كافية للتقرير</h3>
            <p>أضف موظفين وسجلات حضور ليظهر التقرير.</p>
          </div>
        ) : (
          <>
          <p className="table-note">هذا الجدول مختصر سريع. افتح ملف الموظف لمشاهدة تفاصيل الراتب والقيود المالية وسجل الحضور.</p>
          <table>
            <thead>
              <tr>
                <th>الموظف</th>
                <th>القسم</th>
                <th>الحضور</th>
                <th>الغياب</th>
                <th>إجمالي الخصم</th>
                <th>صافي الراتب</th>
              </tr>
            </thead>
            <tbody>
              {[...monthlyRows].sort((a, b) => b.net_salary - a.net_salary).slice(0, 10).map((row) => (
                <tr key={row.employee_id}>
                  <td style={{ fontWeight: 800 }}><a href={`/admin/employees/${row.employee_id}?month=${month}`}>{row.name}</a></td>
                  <td>{row.department || "—"}</td>
                  <td>{row.attendance_days.toLocaleString("en-US")}</td>
                  <td>{row.absent_days.toLocaleString("en-US")}</td>
                  <td style={{ color: "var(--error)", fontWeight: 700 }}>{money(row.total_deductions)} {settings.currency}</td>
                  <td><strong style={{ color: "var(--success)" }}>{money(row.net_salary)} {settings.currency}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </section>
    </div>
  );
}
