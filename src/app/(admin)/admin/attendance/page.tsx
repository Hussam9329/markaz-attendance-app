import { getSettings } from "@/lib/settings";
import { getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getAttendanceByDate, getCrewEmployees, getDaySummary } from "@/lib/attendance";
import { addManualAttendance, deleteAttendanceRecord } from "../employees/actions";

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
  let crewEmployees: Awaited<ReturnType<typeof getCrewEmployees>> = [];
  let summary = { total_records: 0, present_count: 0, late_count: 0, total_late_minutes: 0, total_deductions: 0 };

  try {
    records = await getAttendanceByDate(date);
    absentEmployees = await getAbsentEmployeesByDate(date);
    crewEmployees = await getCrewEmployees();
    summary = await getDaySummary(date);
  } catch {
    // DB not ready
  }

  const activeEmployees = summary.total_records + absentEmployees.length;
  const attendanceRate = activeEmployees > 0 ? Math.round((summary.total_records / activeEmployees) * 100) : 0;

  // Separate absent by type
  const absentCenter = absentEmployees.filter((e) => e.employee_type !== "crew");
  const absentCrew = absentEmployees.filter((e) => e.employee_type === "crew");

  // Separate records by source
  const qrRecords = records.filter((r) => r.source !== "manual");
  const manualRecords = records.filter((r) => r.source === "manual");

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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <a className="btn btn-accent" href="/" target="_blank">📱 ماسح QR للمركز</a>
        </div>
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

      {/* Manual Attendance Entry for Crew Employees */}
      {crewEmployees.length > 0 && (
        <section className="card-elevated">
          <div className="section-heading">
            <div>
              <h2>✍️ إدخال حضور يدوي — موظفو الطاقم</h2>
              <p>اختر موظف الطاقم وأدخل حضوره وتفاصيل راتبه يدوياً لهذا اليوم.</p>
            </div>
          </div>
          <form action={addManualAttendance} className="professional-form-grid compact">
            <input type="hidden" name="local_date" value={date} />
            <div className="form-group">
              <label className="form-label">موظف الطاقم</label>
              <select className="form-input" name="employee_id" required>
                <option value="">— اختر موظف الطاقم —</option>
                {crewEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.employee_code} — {emp.name} ({emp.department || "بدون قسم"})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">وقت الحضور</label>
              <input className="form-input" name="local_time" type="time" defaultValue="09:00" />
            </div>
            <div className="form-group">
              <label className="form-label">الحالة</label>
              <select className="form-input" name="status">
                <option value="present">✅ حاضر</option>
                <option value="late">⏰ متأخر</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>
              ✍️ تسجيل حضور يدوي
            </button>
          </form>
        </section>
      )}

      {/* QR Attendance Records */}
      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>📱 سجلات حضور المركز (QR) — {dateFormatted}</h2>
            <p>سجلات الحضور عبر مسح QR — إجمالي خصومات التأخير: {money(summary.total_deductions)} {settings.currency}</p>
          </div>
        </div>
        {qrRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📱</div>
            <h3>لا توجد سجلات حضور QR في هذا التاريخ</h3>
            <p>لم يتم تسجيل أي حضور بالـ QR في {dateFormatted}</p>
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
                {qrRecords.map((r, i) => (
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

      {/* Manual Attendance Records */}
      {manualRecords.length > 0 && (
        <section className="card-elevated">
          <div className="section-heading">
            <div>
              <h2>✍️ سجلات حضور الطاقم (يدوي) — {dateFormatted}</h2>
              <p>سجلات الحضور المدخلة يدوياً لموظفي الطاقم</p>
            </div>
          </div>
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
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {manualRecords.map((r, i) => (
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
                    <td>
                      <form action={deleteAttendanceRecord} style={{ display: "inline" }}>
                        <input type="hidden" name="record_id" value={r.id} />
                        <button className="btn btn-ghost btn-sm" type="submit" style={{ color: "var(--error)" }}>🗑️</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Absent Employees */}
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
                  <th>النوع</th>
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
                    <td>
                      <span className={`type-badge ${emp.employee_type === "crew" ? "badge-crew" : "badge-center"}`}>
                        {emp.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}
                      </span>
                    </td>
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
