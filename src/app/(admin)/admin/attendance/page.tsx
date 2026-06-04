import { getSettings } from "@/lib/settings";
import { getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getAttendanceByDate, getDaySummary } from "@/lib/attendance";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("ar-IQ");
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();
  const today = getLocalParts(new Date(), settings.timezone).date;
  const date = params.date || today;

  let records: Awaited<ReturnType<typeof getAttendanceByDate>> = [];
  let absentEmployees: Awaited<ReturnType<typeof getAbsentEmployeesByDate>> = [];
  let summary = { total_records: 0, present_count: 0, late_count: 0, total_late_minutes: 0, total_deductions: 0 };

  try {
    records = await getAttendanceByDate(date);
    absentEmployees = await getAbsentEmployeesByDate(date);
    summary = await getDaySummary(date);
  } catch {
    // DB not ready
  }

  const activeEmployees = summary.total_records + absentEmployees.length;
  const attendanceRate = activeEmployees > 0 ? Math.round((summary.total_records / activeEmployees) * 100) : 0;

  const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString("ar-IQ", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128203; الحضور</div>
          <h1>متابعة الحضور والانصراف اليومي</h1>
          <p>عرض الحاضرين، المتأخرين، والغائبين — {dateFormatted}</p>
        </div>
        <a className="btn btn-accent" href="/" target="_blank">📱 فتح ماسح QR</a>
      </header>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">اختر التاريخ</label>
            <input className="form-input" name="date" type="date" defaultValue={date} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        {date !== today && (
          <a href="/admin/attendance" className="btn btn-secondary">اليوم</a>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">📊</div>
          <span className="stat-label">نسبة الحضور</span>
          <strong className="stat-value">{attendanceRate.toLocaleString("ar-IQ")}%</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">✅</div>
          <span className="stat-label">حضور ضمن الوقت</span>
          <strong className="stat-value">{summary.present_count.toLocaleString("ar-IQ")}</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">⏰</div>
          <span className="stat-label">متأخرون</span>
          <strong className="stat-value">{summary.late_count.toLocaleString("ar-IQ")}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>🚫</div>
          <span className="stat-label">غائبون</span>
          <strong className="stat-value">{absentEmployees.length.toLocaleString("ar-IQ")}</strong>
        </article>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>📋 سجلات الحضور — {dateFormatted}</h2>
            <p>إجمالي خصومات التأخير لهذا اليوم: {money(summary.total_deductions)} {settings.currency}</p>
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>لا توجد سجلات حضور في هذا التاريخ</h3>
            <p>لم يتم تسجيل أي حضور في {dateFormatted}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الكود</th>
                  <th>الموظف</th>
                  <th>القسم</th>
                  <th>الوظيفة</th>
                  <th>وقت الحضور</th>
                  <th>الحالة</th>
                  <th>دقائق التأخير</th>
                  <th>الخصم</th>
                  <th>الملف</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td>{r.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.employee_name}</td>
                    <td>{r.department || "—"}</td>
                    <td>{r.job_title || "—"}</td>
                    <td style={{ fontWeight: 700, fontSize: "15px" }}>{r.local_time}</td>
                    <td>
                      <span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>
                        {r.status === "present" ? "✅ حاضر" : "⏰ متأخر"}
                      </span>
                    </td>
                    <td>{r.late_minutes > 0 ? <span style={{ color: "var(--warning)", fontWeight: 700 }}>{r.late_minutes} دقيقة</span> : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                    <td>
                      <a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">📄</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>🚫 قائمة الغائبين</h2>
            <p>تُحسب من الموظفين الفعالين الذين لا يملكون سجل حضور في التاريخ المختار.</p>
          </div>
        </div>
        {absentEmployees.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>✅</div>
            <h3 style={{ fontSize: "16px" }}>لا توجد غيابات مسجلة لهذا اليوم</h3>
            <p style={{ fontSize: "13px" }}>كل الموظفين الفعالين لديهم سجل حضور.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>الكود</th>
                  <th>الموظف</th>
                  <th>القسم</th>
                  <th>الوظيفة</th>
                  <th>الهاتف</th>
                  <th>الملف</th>
                </tr>
              </thead>
              <tbody>
                {absentEmployees.map((emp, i) => (
                  <tr key={emp.id}>
                    <td>{i + 1}</td>
                    <td>{emp.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{emp.name}</td>
                    <td>{emp.department || "—"}</td>
                    <td>{emp.job_title || "—"}</td>
                    <td>{emp.phone || "—"}</td>
                    <td><a href={`/admin/employees/${emp.id}`} className="btn btn-ghost btn-sm">📄</a></td>
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
