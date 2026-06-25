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
      base: acc.base + row.salary_base_calculated,
      allowance: acc.allowance + row.allowance,
      overtime: acc.overtime + row.overtime_amount,
      bonus: acc.bonus + row.automatic_bonus,
      additions: acc.additions + row.manual_additions,
      gross: acc.gross + row.gross_salary,
      late: acc.late + row.late_deductions,
      absence: acc.absence + row.absence_deductions,
      manualDeductions: acc.manualDeductions + row.manual_deductions,
      deductions: acc.deductions + row.total_deductions,
      net: acc.net + row.net_salary,
      attendance: acc.attendance + row.attendance_days,
      absenceDays: acc.absenceDays + row.absent_days,
      extraDays: acc.extraDays + row.extra_days,
    }),
    { base: 0, allowance: 0, overtime: 0, bonus: 0, additions: 0, gross: 0, late: 0, absence: 0, manualDeductions: 0, deductions: 0, net: 0, attendance: 0, absenceDays: 0, extraDays: 0 }
  );

  const centerRows = rows.filter((r) => r.employee_type !== "crew");
  const crewRows = rows.filter((r) => r.employee_type === "crew");
  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-IQ", { month: "long", year: "numeric" });

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128176; الرواتب</div>
          <h1>كشف الرواتب الذكي</h1>
          <p>راتب اسمي + أيام إضافية + مكافآت + مهام − غياب بعذر/بدون عذر − تأخير − قيود يدوية — {monthLabel}</p>
        </div>
        <a className="btn btn-accent" href={`/api/reports/monthly.csv?month=${month}`}>📥 تنزيل CSV</a>
      </header>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">اختر الشهر</label>
            <input className="form-input" name="month" type="month" defaultValue={month} />
            <span className="form-hint">عقوبة بدون عذر بعد إكمال المطلوب: {money(settings.after_required_unexcused_absence_penalty)} {settings.currency}</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        <a className="btn btn-secondary" href="/admin/settings">⚙️ قواعد الخصم</a>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue"><div className="stat-icon blue">💵</div><span className="stat-label">الراتب المحتسب</span><strong className="stat-value">{money(totals.base)} {settings.currency}</strong></article>
        <article className="stat-card green"><div className="stat-icon green">➕</div><span className="stat-label">إضافي + مكافآت + قيود موجبة</span><strong className="stat-value">{money(totals.overtime + totals.bonus + totals.additions + totals.allowance)} {settings.currency}</strong></article>
        <article className="stat-card"><div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>📉</div><span className="stat-label">إجمالي الخصومات</span><strong className="stat-value" style={{ color: "var(--error)" }}>{money(totals.deductions)} {settings.currency}</strong></article>
        <article className="stat-card green"><div className="stat-icon green">✅</div><span className="stat-label">صافي الرواتب</span><strong className="stat-value" style={{ color: "var(--success)" }}>{money(totals.net)} {settings.currency}</strong></article>
      </section>

      <section className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <article className="stat-card blue"><span className="stat-label">أيام الحضور</span><strong className="stat-value">{totals.attendance.toLocaleString("ar-IQ")}</strong></article>
        <article className="stat-card green"><span className="stat-label">الأيام الإضافية</span><strong className="stat-value">{totals.extraDays.toLocaleString("ar-IQ")}</strong></article>
        <article className="stat-card orange"><span className="stat-label">أيام الغياب</span><strong className="stat-value">{totals.absenceDays.toLocaleString("ar-IQ")}</strong></article>
        <article className="stat-card"><span className="stat-label">عدد المركز / الطاقم</span><strong className="stat-value">{centerRows.length.toLocaleString("ar-IQ")} / {crewRows.length.toLocaleString("ar-IQ")}</strong></article>
      </section>

      <section className="steps-grid payroll-breakdown">
        <article className="step-card"><div className="step-number">1</div><div className="step-text"><strong>الراتب المحتسب</strong><span>{money(totals.base)} {settings.currency}</span></div></article>
        <article className="step-card"><div className="step-number">+</div><div className="step-text"><strong>أيام إضافية</strong><span>{money(totals.overtime)} {settings.currency}</span></div></article>
        <article className="step-card"><div className="step-number">+</div><div className="step-text"><strong>مكافآت تلقائية</strong><span>{money(totals.bonus)} {settings.currency}</span></div></article>
        <article className="step-card"><div className="step-number">−</div><div className="step-text"><strong>غياب وتأخير ويدوي</strong><span>{money(totals.deductions)} {settings.currency}</span></div></article>
      </section>

      {rows.length === 0 ? (
        <section className="card"><div className="empty-state"><div className="empty-icon">💰</div><h3>لا توجد بيانات رواتب لهذا الشهر</h3><p>أضف موظفين فعالين وسجّل حضورهم أو غيابهم حتى يظهر كشف الراتب.</p></div></section>
      ) : (
        <section className="card-elevated table-wrap">
          <table>
            <thead>
              <tr>
                <th>الكود</th><th>الموظف</th><th>النوع</th><th>الوظيفة</th><th>الراتب الاسمي</th><th>المطلوب</th><th>الحضور</th><th>الإضافي</th><th>أجر الإضافي</th><th>غياب بعذر</th><th>غياب بدون عذر</th><th>خصم الغياب</th><th>خصم التأخير</th><th>قيود +</th><th>قيود −</th><th>مكافأة</th><th>الإجمالي</th><th>الصافي</th><th>الملف</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.employee_id} className={row.employee_type === "crew" ? "crew-row" : ""}>
                  <td>{row.employee_code || "—"}</td>
                  <td style={{ fontWeight: 800 }}>{row.name}</td>
                  <td><span className={`type-badge ${row.employee_type === "crew" ? "badge-crew" : "badge-center"}`}>{row.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}</span></td>
                  <td>{row.job_title || "—"}</td>
                  <td>{money(row.monthly_salary)}</td>
                  <td>{row.required_workdays}</td>
                  <td>{row.attendance_days}</td>
                  <td>{row.extra_days}</td>
                  <td>{money(row.overtime_amount)}</td>
                  <td>{row.absent_excused_days}</td>
                  <td>{row.absent_unexcused_days}</td>
                  <td style={{ color: row.absence_deductions > 0 ? "var(--error)" : undefined, fontWeight: 700 }}>{money(row.absence_deductions)}</td>
                  <td style={{ color: row.late_deductions > 0 ? "var(--error)" : undefined, fontWeight: 700 }}>{money(row.late_deductions)}</td>
                  <td>{money(row.manual_additions)}</td>
                  <td style={{ color: row.manual_deductions > 0 ? "var(--error)" : undefined }}>{money(row.manual_deductions)}</td>
                  <td>{row.bonus_eligible ? `✅ ${money(row.automatic_bonus)}` : row.bonus_enabled ? "محجوبة" : "—"}</td>
                  <td><strong>{money(row.gross_salary)}</strong></td>
                  <td><strong style={{ color: "var(--success)" }}>{money(row.net_salary)} {settings.currency}</strong></td>
                  <td><a href={`/admin/employees/${row.employee_id}?month=${month}`} className="btn btn-ghost btn-sm">📄</a></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--surface-2)", fontWeight: 900 }}>
                <td>الإجمالي</td><td></td><td></td><td></td><td>{money(rows.reduce((s, r) => s + r.monthly_salary, 0))}</td><td></td><td>{totals.attendance}</td><td>{totals.extraDays}</td><td>{money(totals.overtime)}</td><td></td><td></td><td>{money(totals.absence)}</td><td>{money(totals.late)}</td><td>{money(totals.additions)}</td><td>{money(totals.manualDeductions)}</td><td>{money(totals.bonus)}</td><td>{money(totals.gross)}</td><td style={{ color: "var(--success)" }}>{money(totals.net)} {settings.currency}</td><td></td>
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
}
