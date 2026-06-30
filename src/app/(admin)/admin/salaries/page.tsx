import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";
import { getMonthlySalaryReport } from "@/lib/report";
import { FutureHero, FutureMetricGrid } from "@/components/future/FutureDashboard";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
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
  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-IQ-u-nu-latn", { month: "long", year: "numeric" });
  const topNetRows = [...rows].sort((a, b) => b.net_salary - a.net_salary).slice(0, 6);

  return (
    <div className="stack payroll-board-page">
      <FutureHero
        eyebrow="💰 لوحة الرواتب — React Payroll Board"
        title="مراجعة الرواتب بالكارتات أولاً"
        description={<>عرض مريح للشهر {monthLabel}: راجع الصافي والإضافات والخصومات، ثم افتح الجدول الجماعي فقط عند الحاجة.</>}
        actions={<>
          <a className="btn btn-accent" href={`/api/reports/monthly.csv?month=${month}`}>📥 تنزيل CSV</a>
          <a className="btn btn-secondary" href="/admin/settings">⚙️ قواعد الخصم</a>
        </>}
        stats={[
          { label: "صافي الرواتب", value: `${money(totals.net)} ${settings.currency}`, tone: "emerald" },
          { label: "الخصومات", value: `${money(totals.deductions)} ${settings.currency}`, tone: totals.deductions > 0 ? "rose" : "violet" },
          { label: "عدد الموظفين", value: rows.length.toLocaleString("en-US"), tone: "cyan" },
        ]}
      />

      <section className="daily-control-panel payroll-control-panel">
        <article className="control-card date-control-card">
          <span className="control-step">شهر</span>
          <h2>اختر الشهر المالي</h2>
          <p>كل الحسابات، القيود، والغيابات تعرض حسب الشهر المختار.</p>
          <form className="toolbar-form compact-toolbar" method="get">
            <input className="form-input" name="month" type="month" defaultValue={month} />
            <button className="btn btn-primary" type="submit">عرض</button>
          </form>
        </article>
        <article className="control-card">
          <span className="control-step">قواعد</span>
          <h2>قرار الغياب المعتمد</h2>
          <p>بدون عذر بعد إكمال المطلوب يخصم عقوبة فقط.</p>
          <strong className="big-control-number">{money(settings.after_required_unexcused_absence_penalty)}</strong>
          <span className="muted-line">{settings.currency}</span>
        </article>
        <article className="control-card urgent-control-card">
          <span className="control-step">جماعي</span>
          <h2>إدخال سريع مثل الشيت</h2>
          <p>الجدول التفصيلي موجود بالأسفل داخل وضع الإدخال الجماعي للمراجعة والتصدير.</p>
          <a href="#bulk-payroll" className="btn btn-secondary btn-sm">فتح الجدول</a>
        </article>
      </section>

      <FutureMetricGrid
        metrics={[
          { label: "الراتب المحتسب", value: money(totals.base), suffix: settings.currency, icon: "💵", tone: "cyan", progress: totals.gross > 0 ? Math.round((totals.base / totals.gross) * 100) : 0, trend: "أساس كشف الشهر", sparkline: [0, totals.base / 3, totals.base / 2, totals.base] },
          { label: "إضافي + مكافآت + قيود موجبة", value: money(totals.overtime + totals.bonus + totals.additions + totals.allowance), suffix: settings.currency, icon: "➕", tone: "emerald", progress: totals.gross > 0 ? Math.round(((totals.overtime + totals.bonus + totals.additions + totals.allowance) / totals.gross) * 100) : 0, trend: `${totals.extraDays.toLocaleString("en-US")} أيام إضافية`, sparkline: [0, totals.overtime, totals.bonus, totals.additions + totals.allowance] },
          { label: "إجمالي الخصومات", value: money(totals.deductions), suffix: settings.currency, icon: "📉", tone: totals.deductions > 0 ? "rose" : "violet", progress: totals.gross > 0 ? Math.round((totals.deductions / totals.gross) * 100) : 0, trend: `${totals.absenceDays.toLocaleString("en-US")} أيام غياب`, sparkline: [0, totals.late, totals.absence, totals.deductions] },
          { label: "صافي الرواتب", value: money(totals.net), suffix: settings.currency, icon: "✅", tone: "emerald", progress: totals.gross > 0 ? Math.round((totals.net / totals.gross) * 100) : 0, trend: "الرقم النهائي للدفع", sparkline: [0, totals.gross / 3, totals.gross / 2, totals.net] },
        ]}
      />

      <section className="workflow-board payroll-workflow-board">
        <article className="workflow-lane lane-primary"><div className="lane-kicker">1</div><h2>راجع الكارتات</h2><p>كل موظف يظهر بكارت يلخص الراتب النهائي وأسباب الزيادة والنقصان.</p></article>
        <article className="workflow-lane lane-warning"><div className="lane-kicker">2</div><h2>افتح ملف الموظف</h2><p>أي قيد مالي أو مكافأة أو سلفة تدخل من ملف الموظف المركزي.</p></article>
        <article className="workflow-lane lane-success"><div className="lane-kicker">3</div><h2>صدّر عند الاعتماد</h2><p>بعد المراجعة، نزّل CSV للنسخ أو الطباعة أو الأرشفة.</p></article>
      </section>

      {rows.length === 0 ? (
        <section className="card"><div className="empty-state"><div className="empty-icon">💰</div><h3>لا توجد بيانات رواتب لهذا الشهر</h3><p>أضف موظفين فعالين وسجّل حضورهم أو غيابهم حتى يظهر كشف الراتب.</p></div></section>
      ) : (
        <>
          <section className="salary-card-grid">
            {rows.map((row) => (
              <article className={`salary-review-card ${row.total_deductions > 0 ? "has-deductions" : "is-clean"}`} key={row.employee_id}>
                <div className="salary-card-head">
                  <div>
                    <span className={`type-badge ${row.employee_type === "crew" ? "badge-crew" : "badge-center"}`}>{row.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}</span>
                    <h2>{row.name}</h2>
                    <p>{row.employee_code || "بدون كود"} · {row.job_title || "بدون وظيفة"}</p>
                  </div>
                  <strong className="salary-net">{money(row.net_salary)} <small>{settings.currency}</small></strong>
                </div>
                <div className="salary-equation">
                  <span>أساس {money(row.salary_base_calculated)}</span>
                  <span>+ إضافي {money(row.overtime_amount)}</span>
                  <span>+ مكافأة {money(row.automatic_bonus)}</span>
                  <span>- خصم {money(row.total_deductions)}</span>
                </div>
                <div className="metric-strip salary-mini-strip">
                  <div><span>حضور</span><strong>{row.attendance_days} / {row.required_workdays}</strong></div>
                  <div><span>إضافي</span><strong>{row.extra_days}</strong></div>
                  <div><span>غياب</span><strong>{row.absent_days}</strong></div>
                  <div><span>تأخير</span><strong>{row.late_days}</strong></div>
                </div>
                <div className="card-action-rail">
                  <a href={`/admin/employees/${row.employee_id}?month=${month}`} className="btn btn-primary btn-sm">فتح التفصيل</a>
                  <a href="/admin/attendance" className="btn btn-secondary btn-sm">مراجعة الحضور</a>
                </div>
              </article>
            ))}
          </section>

          <section className="dashboard-split">
            <article className="card-elevated calm-panel">
              <div className="section-heading"><div><h2>🏆 أعلى صافي رواتب</h2><p>ملخص سريع لأكبر القيم حتى تراجعها قبل الاعتماد.</p></div></div>
              <div className="rank-list">
                {topNetRows.map((row, index) => (
                  <a href={`/admin/employees/${row.employee_id}?month=${month}`} className="rank-item" key={row.employee_id}>
                    <span>{(index + 1).toLocaleString("en-US")}</span>
                    <strong>{row.name}</strong>
                    <em>{money(row.net_salary)} {settings.currency}</em>
                  </a>
                ))}
              </div>
            </article>
            <article className="card-elevated calm-panel">
              <div className="section-heading"><div><h2>📌 ملخص شهري</h2><p>مؤشرات تشغيلية مرتبطة بالراتب.</p></div></div>
              <div className="salary-radar">
                <div><span>أيام الحضور</span><strong>{totals.attendance.toLocaleString("en-US")}</strong></div>
                <div><span>الأيام الإضافية</span><strong>{totals.extraDays.toLocaleString("en-US")}</strong></div>
                <div><span>أيام الغياب</span><strong className="danger-text">{totals.absenceDays.toLocaleString("en-US")}</strong></div>
                <div><span>مركز / طاقم</span><strong>{centerRows.length.toLocaleString("en-US")} / {crewRows.length.toLocaleString("en-US")}</strong></div>
              </div>
            </article>
          </section>

          <details id="bulk-payroll" className="card-elevated bulk-details" open>
            <summary>📊 وضع الإدخال والمراجعة الجماعية <span>جدول شبيه بالشيت عند الحاجة فقط</span></summary>
            <p className="table-note">هذا الوضع مخصص للمراجعة النهائية والتصدير. الإدخالات المالية التفصيلية تتم من ملف الموظف حتى يبقى لكل مبلغ سبب وملاحظة.</p>
            <div className="table-wrap">
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
                      <td className={row.absence_deductions > 0 ? "danger-text" : undefined}>{money(row.absence_deductions)}</td>
                      <td className={row.late_deductions > 0 ? "danger-text" : undefined}>{money(row.late_deductions)}</td>
                      <td>{money(row.manual_additions)}</td>
                      <td className={row.manual_deductions > 0 ? "danger-text" : undefined}>{money(row.manual_deductions)}</td>
                      <td>{row.bonus_eligible ? `✅ ${money(row.automatic_bonus)}` : row.bonus_enabled ? "محجوبة" : "—"}</td>
                      <td><strong>{money(row.gross_salary)}</strong></td>
                      <td><strong className="success-text">{money(row.net_salary)} {settings.currency}</strong></td>
                      <td><a href={`/admin/employees/${row.employee_id}?month=${month}`} className="btn btn-ghost btn-sm">📄</a></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "var(--surface-2)", fontWeight: 900 }}>
                    <td>الإجمالي</td><td></td><td></td><td></td><td>{money(rows.reduce((s, r) => s + r.monthly_salary, 0))}</td><td></td><td>{totals.attendance}</td><td>{totals.extraDays}</td><td>{money(totals.overtime)}</td><td></td><td></td><td>{money(totals.absence)}</td><td>{money(totals.late)}</td><td>{money(totals.additions)}</td><td>{money(totals.manualDeductions)}</td><td>{money(totals.bonus)}</td><td>{money(totals.gross)}</td><td className="success-text">{money(totals.net)} {settings.currency}</td><td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
