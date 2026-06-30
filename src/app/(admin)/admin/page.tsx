import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth, getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getDaySummary, getRecentAttendance } from "@/lib/attendance";
import { getMonthlySalaryReport } from "@/lib/report";
import { FutureHero, FutureMetricGrid, FutureTransferNotice, FutureWeeklyChart } from "@/components/future/FutureDashboard";

export const dynamic = "force-dynamic";

function num(v: unknown) { return Number(v ?? 0).toLocaleString("en-US"); }
function money(v: unknown) { return Number(v ?? 0).toLocaleString("en-US"); }

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
    recentRecords = await getRecentAttendance(8);
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
      extraDays: acc.extraDays + row.extra_days,
      bonus: acc.bonus + row.automatic_bonus,
    }),
    { gross: 0, deductions: 0, net: 0, absentDays: 0, extraDays: 0, bonus: 0 }
  );

  const attendanceRate = activeEmployees > 0 ? Math.round((todaySummary.total_records / activeEmployees) * 100) : 0;
  const todayFormatted = new Date().toLocaleDateString("ar-EG-u-nu-latn", {
    weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: settings.timezone,
  });
  const pendingAbsenceLabel = absentToday > 0 ? `${num(absentToday)} يحتاجون حسم` : "اليوم محسوم";
  const weeklyMap = new Map<string, { label: string; present: number; late: number; absent: number }>();
  for (const record of recentRecords) {
    const label = record.local_date;
    const current = weeklyMap.get(label) ?? { label, present: 0, late: 0, absent: 0 };
    if (record.status === "late") current.late += 1;
    else if (record.status === "absent") current.absent += 1;
    else current.present += 1;
    weeklyMap.set(label, current);
  }
  const weeklyPoints = Array.from(weeklyMap.values()).slice(-7);
  const chartPoints = weeklyPoints.length > 0 ? weeklyPoints : [{ label: "اليوم", present: todaySummary.present_count, late: todaySummary.late_count, absent: absentToday }];

  return (
    <div className="stack command-shell">
      <FutureHero
        eyebrow="◆ مركز العمليات اليومي — React Future Console"
        title="إدارة اليوم من شاشة واحدة"
        description={<> {settings.center_name} — {todayFormatted}. ابدأ بالحضور، احسم الغياب، ثم راجع أثر اليوم على الرواتب من نفس واجهة React المستقبلية. </>}
        actions={<>
          <a className="btn btn-primary" href="/admin/attendance">بدء حضور اليوم</a>
          <a className="btn btn-accent" href="/admin/salaries">مراجعة الرواتب</a>
          <a className="btn btn-secondary" href="/admin/employees">ملفات الموظفين</a>
        </>}
        stats={[
          { label: "حضور اليوم", value: `${num(todaySummary.total_records)} / ${num(activeEmployees)}`, tone: "cyan" },
          { label: "نسبة الإنجاز", value: `${num(attendanceRate)}%`, tone: "emerald" },
          { label: "غياب غير محسوم", value: pendingAbsenceLabel, tone: absentToday > 0 ? "rose" : "violet" },
        ]}
      />

      <section className="workflow-board">
        <article className="workflow-lane lane-primary">
          <div className="lane-kicker">1</div>
          <h2>تسجيل الحضور</h2>
          <p>افتح QR أو أدخل الحضور اليدوي للطاقم والحالات الخاصة.</p>
          <div className="lane-actions">
            <a href="/scan" target="_blank" className="btn btn-primary btn-sm">📱 ماسح QR</a>
            <a href="/admin/attendance" className="btn btn-secondary btn-sm">✍️ إدخال يدوي</a>
          </div>
        </article>
        <article className="workflow-lane lane-warning">
          <div className="lane-kicker">2</div>
          <h2>حسم الغياب والتأخير</h2>
          <p>أي موظف بلا بصمة يظهر كحالة غير محسومة حتى تحدد بعذر أو بدون عذر.</p>
          <div className="micro-metrics">
            <span>متأخرون: <strong>{num(todaySummary.late_count)}</strong></span>
            <span>خصم تأخير: <strong>{money(todaySummary.total_deductions)} {settings.currency}</strong></span>
          </div>
          <a href="/admin/attendance" className="btn btn-accent btn-sm">مراجعة اليوم</a>
        </article>
        <article className="workflow-lane lane-success">
          <div className="lane-kicker">3</div>
          <h2>مراجعة الراتب المتوقع</h2>
          <p>الرواتب تتحدث حسب الحضور والغياب والقيود المالية داخل ملف الموظف.</p>
          <div className="micro-metrics">
            <span>الصافي: <strong>{money(payrollTotals.net)} {settings.currency}</strong></span>
            <span>الإضافي: <strong>{num(payrollTotals.extraDays)} يوم</strong></span>
          </div>
          <a href="/admin/salaries" className="btn btn-secondary btn-sm">فتح كشف الشهر</a>
        </article>
      </section>

      <FutureMetricGrid
        metrics={[
          { label: "الموظفون الفعالون / الكلي", value: `${num(activeEmployees)} / ${num(totalEmployees)}`, icon: "👥", tone: "cyan", progress: totalEmployees > 0 ? Math.round((activeEmployees / totalEmployees) * 100) : 0, trend: `${departments.toLocaleString("en-US")} أقسام`, sparkline: [totalEmployees, activeEmployees, activeEmployees + departments, activeEmployees] },
          { label: "نسبة حضور اليوم", value: `${num(attendanceRate)}%`, icon: "📈", tone: "emerald", progress: attendanceRate, trend: "مرتبطة مباشرة بسجلات اليوم", sparkline: [12, 22, 38, 46, attendanceRate] },
          { label: "متأخرون اليوم", value: num(todaySummary.late_count), icon: "⏰", tone: "amber", progress: activeEmployees > 0 ? Math.round((todaySummary.late_count / activeEmployees) * 100) : 0, trend: `${num(todaySummary.total_late_minutes)} دقيقة`, sparkline: [0, todaySummary.late_count, todaySummary.total_late_minutes, todaySummary.late_count] },
          { label: "غائبون غير محسومين", value: num(absentToday), icon: "🚫", tone: absentToday > 0 ? "rose" : "violet", progress: activeEmployees > 0 ? Math.round((absentToday / activeEmployees) * 100) : 0, trend: absentToday > 0 ? "يحتاجون قرار" : "كلشي محسوم", sparkline: [absentToday, absentToday, absentToday + todaySummary.late_count, absentToday] },
        ]}
      />

      <FutureWeeklyChart points={chartPoints} />
      <FutureTransferNotice />

      <section className="dashboard-split">
        <article className="card-elevated calm-panel">
          <div className="section-heading">
            <div>
              <h2>🧭 اختصارات العمل</h2>
              <p>اختصارات مصممة حسب تسلسل الاستخدام اليومي، مو حسب ترتيب القوائم.</p>
            </div>
          </div>
          <div className="quick-command-grid">
            <a href="/admin/attendance" className="quick-command"><strong>حضور اليوم</strong><span>QR، يدوي، غياب بعذر وبدون عذر</span></a>
            <a href="/admin/employees" className="quick-command"><strong>إضافة موظف</strong><span>خطوات منظمة: بيانات، دوام، راتب</span></a>
            <a href="/admin/salaries" className="quick-command"><strong>الرواتب</strong><span>كارتات مراجعة + جدول جماعي</span></a>
            <a href="/admin/reports" className="quick-command"><strong>التقارير</strong><span>تصدير ومراجعة شهرية</span></a>
          </div>
        </article>

        <article className="card-elevated calm-panel">
          <div className="section-heading">
            <div>
              <h2>💰 ملخص الرواتب</h2>
              <p>أرقام الشهر الحالي قبل الاعتماد النهائي.</p>
            </div>
          </div>
          <div className="salary-radar">
            <div><span>الإجمالي</span><strong>{money(payrollTotals.gross)} {settings.currency}</strong></div>
            <div><span>الخصومات</span><strong className="danger-text">{money(payrollTotals.deductions)} {settings.currency}</strong></div>
            <div><span>المكافآت</span><strong>{money(payrollTotals.bonus)} {settings.currency}</strong></div>
            <div><span>الصافي</span><strong className="success-text">{money(payrollTotals.net)} {settings.currency}</strong></div>
          </div>
        </article>
      </section>

      <section className="card-elevated calm-panel">
        <div className="section-heading">
          <div>
            <h2>📋 آخر الحركات</h2>
            <p>عرض مختصر بدل الجدول الطويل حتى تعرف آخر نشاط بسرعة.</p>
          </div>
          <a href="/admin/attendance" className="btn btn-ghost btn-sm">عرض الحضور الكامل ←</a>
        </div>

        {recentRecords.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>📋</div>
            <h3 style={{ fontSize: "16px" }}>لا توجد سجلات حضور بعد</h3>
            <p style={{ fontSize: "13px" }}>سيظهر هنا سجل الحضور فور تسجيل أول حضور.</p>
          </div>
        ) : (
          <div className="activity-card-grid compact-activity-grid">
            {recentRecords.map((r) => (
              <article className="activity-card" key={r.id}>
                <div className="activity-main">
                  <span className={`status-dot ${r.status === "present" ? "is-ok" : "is-warn"}`}></span>
                  <div>
                    <strong>{r.employee_name}</strong>
                    <span>{r.employee_code || "بدون كود"} · {r.department || "بدون قسم"}</span>
                  </div>
                </div>
                <div className="activity-meta">
                  <span>{r.local_date}</span>
                  <span>{r.local_time}</span>
                  <span>{r.late_minutes > 0 ? `${num(r.late_minutes)} دقيقة تأخير` : "ضمن الوقت"}</span>
                </div>
                <a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">ملف الموظف</a>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
