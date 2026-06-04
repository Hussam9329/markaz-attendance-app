import { getMonthlySalaryReport } from "@/lib/report";
import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("ar-IQ");
}

export default async function SalariesPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();
  const month = params.month || currentMonth(settings.timezone);
  let rows: Awaited<ReturnType<typeof getMonthlySalaryReport>> = [];

  try {
    rows = await getMonthlySalaryReport(month);
  } catch {
    // DB not ready
  }

  const totals = rows.reduce(
    (acc, row) => ({
      base: acc.base + row.monthly_salary,
      allowance: acc.allowance + row.allowance,
      gross: acc.gross + row.gross_salary,
      late: acc.late + row.late_deductions,
      absence: acc.absence + row.absence_deductions,
      deductions: acc.deductions + row.total_deductions,
      net: acc.net + row.net_salary,
      attendance: acc.attendance + row.attendance_days,
      absenceDays: acc.absenceDays + row.absent_days,
    }),
    { base: 0, allowance: 0, gross: 0, late: 0, absence: 0, deductions: 0, net: 0, attendance: 0, absenceDays: 0 }
  );

  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-IQ", { month: "long", year: "numeric" });
  const expectedWorkdays = rows[0]?.expected_workdays ?? Number(settings.workdays_per_month || 0);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128176; الرواتب</div>
          <h1>كشف الرواتب والخصومات الشهرية</h1>
          <p>احتساب الراتب الأساسي، المخصصات، خصم التأخير، خصم الغياب، وصافي الراتب — {monthLabel}</p>
        </div>
        <a className="btn btn-accent" href={`/api/reports/monthly.csv?month=${month}`}>📥 تنزيل CSV</a>
      </header>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">اختر الشهر</label>
            <input className="form-input" name="month" type="month" defaultValue={month} />
            <span className="form-hint">الأيام المتوقعة لهذا الكشف: {expectedWorkdays.toLocaleString("ar-IQ")} يوم عمل</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        <a className="btn btn-secondary" href="/admin/settings">⚙️ قواعد الخصم</a>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">💵</div>
          <span className="stat-label">إجمالي المستحق</span>
          <strong className="stat-value">{money(totals.gross)} {settings.currency}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>📉</div>
          <span className="stat-label">إجمالي الخصومات</span>
          <strong className="stat-value" style={{ color: "var(--error)" }}>{money(totals.deductions)} {settings.currency}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">✅</div>
          <span className="stat-label">صافي الرواتب</span>
          <strong className="stat-value" style={{ color: "var(--success)" }}>{money(totals.net)} {settings.currency}</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">🚫</div>
          <span className="stat-label">إجمالي أيام الغياب</span>
          <strong className="stat-value">{totals.absenceDays.toLocaleString("ar-IQ")}</strong>
        </article>
      </section>

      <section className="steps-grid payroll-breakdown">
        <article className="step-card">
          <div className="step-number">1</div>
          <div className="step-text"><strong>الراتب الأساسي</strong><span>{money(totals.base)} {settings.currency}</span></div>
        </article>
        <article className="step-card">
          <div className="step-number">+</div>
          <div className="step-text"><strong>المخصصات</strong><span>{money(totals.allowance)} {settings.currency}</span></div>
        </article>
        <article className="step-card">
          <div className="step-number">−</div>
          <div className="step-text"><strong>خصم التأخير</strong><span>{money(totals.late)} {settings.currency}</span></div>
        </article>
        <article className="step-card">
          <div className="step-number">−</div>
          <div className="step-text"><strong>خصم الغياب</strong><span>{money(totals.absence)} {settings.currency}</span></div>
        </article>
      </section>

      {rows.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <div className="empty-icon">💰</div>
            <h3>لا توجد بيانات رواتب لهذا الشهر</h3>
            <p>أضف موظفين فعالين وسجّل حضورهم حتى يظهر كشف الراتب.</p>
          </div>
        </section>
      ) : (
        <section className="card-elevated table-wrap">
          <table>
            <thead>
              <tr>
                <th>الكود</th>
                <th>الموظف</th>
                <th>القسم</th>
                <th>الوظيفة</th>
                <th>الراتب</th>
                <th>المخصصات</th>
                <th>المستحق</th>
                <th>الحضور</th>
                <th>الغياب</th>
                <th>التأخير</th>
                <th>خصم التأخير</th>
                <th>خصم الغياب</th>
                <th>إجمالي الخصم</th>
                <th>صافي الراتب</th>
                <th>الملف</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee_id}>
                  <td>{row.employee_code || "—"}</td>
                  <td style={{ fontWeight: 700 }}>{row.name}</td>
                  <td>{row.department || "—"}</td>
                  <td>{row.job_title || "—"}</td>
                  <td>{money(row.monthly_salary)} {settings.currency}</td>
                  <td>{money(row.allowance)} {settings.currency}</td>
                  <td><strong>{money(row.gross_salary)} {settings.currency}</strong></td>
                  <td>{row.attendance_days.toLocaleString("ar-IQ")}</td>
                  <td style={{ color: row.absent_days > 0 ? "var(--error)" : undefined, fontWeight: 700 }}>{row.absent_days.toLocaleString("ar-IQ")}</td>
                  <td>{row.late_days.toLocaleString("ar-IQ")} يوم / {row.total_late_minutes.toLocaleString("ar-IQ")} د</td>
                  <td style={{ color: "var(--error)", fontWeight: 700 }}>{money(row.late_deductions)} {settings.currency}</td>
                  <td style={{ color: "var(--error)", fontWeight: 700 }}>{money(row.absence_deductions)} {settings.currency}</td>
                  <td style={{ color: "var(--error)", fontWeight: 700 }}>{money(row.total_deductions)} {settings.currency}</td>
                  <td><strong style={{ color: "var(--success)" }}>{money(row.net_salary)} {settings.currency}</strong></td>
                  <td><a href={`/admin/employees/${row.employee_id}?month=${month}`} className="btn btn-ghost btn-sm">📄</a></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--surface-2)", fontWeight: 900 }}>
                <td>الإجمالي</td>
                <td></td>
                <td></td>
                <td></td>
                <td>{money(totals.base)} {settings.currency}</td>
                <td>{money(totals.allowance)} {settings.currency}</td>
                <td>{money(totals.gross)} {settings.currency}</td>
                <td>{totals.attendance.toLocaleString("ar-IQ")}</td>
                <td>{totals.absenceDays.toLocaleString("ar-IQ")}</td>
                <td></td>
                <td style={{ color: "var(--error)" }}>{money(totals.late)} {settings.currency}</td>
                <td style={{ color: "var(--error)" }}>{money(totals.absence)} {settings.currency}</td>
                <td style={{ color: "var(--error)" }}>{money(totals.deductions)} {settings.currency}</td>
                <td style={{ color: "var(--success)" }}>{money(totals.net)} {settings.currency}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
}
