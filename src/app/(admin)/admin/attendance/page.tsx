import { getSettings } from "@/lib/settings";
import { getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getActiveEmployees, getAttendanceByDate, getDaySummary } from "@/lib/attendance";
import { addManualAttendance, deleteAttendanceRecord } from "../employees/actions";
import { FutureHero, FutureMetricGrid } from "@/components/future/FutureDashboard";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
}

function statusLabel(record: { status: string; absence_type?: string }) {
  if (record.status === "absent") return record.absence_type === "excused" ? "غياب بعذر" : "غياب بدون عذر";
  if (record.status === "late") return "متأخر";
  return "حاضر";
}

function statusIcon(record: { status: string; absence_type?: string }) {
  if (record.status === "absent") return record.absence_type === "excused" ? "🟡" : "🔴";
  if (record.status === "late") return "🟠";
  return "🟢";
}

function statusClass(record: { status: string; absence_type?: string }) {
  if (record.status === "absent") return record.absence_type === "excused" ? "is-soft-warn" : "is-danger";
  if (record.status === "late") return "is-warn";
  return "is-ok";
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();
  const today = getLocalParts(new Date(), settings.timezone).date;
  const date = params.date || today;

  let records: Awaited<ReturnType<typeof getAttendanceByDate>> = [];
  let absentEmployees: Awaited<ReturnType<typeof getAbsentEmployeesByDate>> = [];
  let manualEmployees: Awaited<ReturnType<typeof getActiveEmployees>> = [];
  let summary = { total_records: 0, present_count: 0, late_count: 0, absent_count: 0, total_late_minutes: 0, total_deductions: 0 };

  try {
    records = await getAttendanceByDate(date);
    absentEmployees = await getAbsentEmployeesByDate(date);
    manualEmployees = await getActiveEmployees();
    summary = await getDaySummary(date);
  } catch {
    // DB not ready
  }

  const activeEmployees = summary.total_records + absentEmployees.length;
  const actualAttendance = summary.present_count + summary.late_count;
  const attendanceRate = activeEmployees > 0 ? Math.round((actualAttendance / activeEmployees) * 100) : 0;
  const qrRecords = records.filter((r) => r.source !== "manual");
  const manualRecords = records.filter((r) => r.source === "manual");

  const dateFormatted = new Date(date + "T00:00:00").toLocaleDateString("ar-IQ-u-nu-latn", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="stack attendance-cockpit">
      <FutureHero
        eyebrow="📋 لوحة حضور اليوم — React Attendance Cockpit"
        title="الحضور والغياب بطريقة عمليات"
        description={<>{dateFormatted} — كل شخص بلا بصمة يظهر كحالة تحتاج قرار، وبعد القرار يدخل مباشرة في الراتب.</>}
        actions={<>
          <a className="btn btn-accent" href="/" target="_blank">📱 ماسح QR</a>
          {date !== today && <a href="/admin/attendance" className="btn btn-secondary">الرجوع لليوم</a>}
        </>}
        stats={[
          { label: "نسبة الحضور", value: `${attendanceRate.toLocaleString("en-US")}%`, tone: "emerald" },
          { label: "الحاضر + المتأخر", value: actualAttendance.toLocaleString("en-US"), tone: "cyan" },
          { label: "غير محسوم", value: absentEmployees.length.toLocaleString("en-US"), tone: absentEmployees.length > 0 ? "rose" : "violet" },
        ]}
      />

      <section className="daily-control-panel">
        <article className="control-card date-control-card">
          <span className="control-step">اليوم</span>
          <h2>اختر تاريخ العمل</h2>
          <p>راجع يوم سابق أو سجل غياب متأخر بدون الدخول في جداول معقدة.</p>
          <form className="toolbar-form compact-toolbar" method="get">
            <input className="form-input" name="date" type="date" defaultValue={date} />
            <button className="btn btn-primary" type="submit">عرض</button>
          </form>
        </article>

        <article className="control-card">
          <span className="control-step">QR</span>
          <h2>دخول سريع للمركز</h2>
          <p>افتح شاشة المسح للموظفين الذين يحضرون بالبصمة أو QR.</p>
          <a className="btn btn-accent" href="/" target="_blank">فتح الماسح</a>
        </article>

        <article className="control-card urgent-control-card">
          <span className="control-step">حسم</span>
          <h2>غياب يحتاج قرار</h2>
          <p>لا تترك الغياب بدون نوع، لأن الراتب يعتمد على بعذر / بدون عذر.</p>
          <strong className="big-control-number">{absentEmployees.length.toLocaleString("en-US")}</strong>
        </article>
      </section>

      <FutureMetricGrid
        metrics={[
          { label: "حضور ضمن الوقت", value: summary.present_count.toLocaleString("en-US"), icon: "✅", tone: "emerald", progress: activeEmployees > 0 ? Math.round((summary.present_count / activeEmployees) * 100) : 0, trend: "سجلات مؤكدة", sparkline: [0, summary.present_count, actualAttendance, summary.present_count] },
          { label: "متأخرون", value: summary.late_count.toLocaleString("en-US"), icon: "⏰", tone: "amber", progress: activeEmployees > 0 ? Math.round((summary.late_count / activeEmployees) * 100) : 0, trend: `${summary.total_late_minutes.toLocaleString("en-US")} دقيقة`, sparkline: [0, summary.late_count, summary.total_late_minutes, summary.late_count] },
          { label: "غياب مسجل / غير محسوم", value: `${summary.absent_count.toLocaleString("en-US")} / ${absentEmployees.length.toLocaleString("en-US")}`, icon: "🚫", tone: absentEmployees.length > 0 ? "rose" : "violet", progress: activeEmployees > 0 ? Math.round((absentEmployees.length / activeEmployees) * 100) : 0, trend: "مرتبط بقرار الراتب", sparkline: [summary.absent_count, absentEmployees.length, summary.absent_count + absentEmployees.length, absentEmployees.length] },
          { label: "خصومات التأخير", value: money(summary.total_deductions), suffix: settings.currency, icon: "💵", tone: "cyan", progress: summary.total_deductions > 0 ? 70 : 0, trend: "محسوبة من إعدادات النظام", sparkline: [0, Number(summary.total_deductions || 0), summary.late_count, Number(summary.total_deductions || 0)] },
        ]}
      />

      <section className="card-elevated calm-panel">
        <div className="section-heading">
          <div>
            <h2>✍️ إدخال يدوي سريع</h2>
            <p>طريقة إدخال واحدة واضحة: اختر الموظف، الحالة، السبب. النظام يتكفل بباقي أثر الراتب.</p>
          </div>
        </div>
        <form action={addManualAttendance} className="manual-entry-flow">
          <input type="hidden" name="local_date" value={date} />
          <div className="flow-field wide-field">
            <span className="flow-number">1</span>
            <label className="form-label">الموظف</label>
            <select className="form-input" name="employee_id" required>
              <option value="">— اختر الموظف —</option>
              {manualEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.name} ({emp.department || "بدون قسم"})</option>
              ))}
            </select>
            <small>اختيار الموظف يربط السجل مباشرة بملفه وراتبه.</small>
          </div>
          <div className="flow-field">
            <span className="flow-number">2</span>
            <label className="form-label">الحالة</label>
            <select className="form-input" name="status" defaultValue="present">
              <option value="present">✅ حاضر</option>
              <option value="late">⏰ متأخر</option>
              <option value="absent">🚫 غائب</option>
            </select>
            <small>الغياب يفعّل نوع الغياب في الحقل التالي.</small>
          </div>
          <div className="flow-field">
            <span className="flow-number">3</span>
            <label className="form-label">وقت الحضور</label>
            <input className="form-input" name="local_time" type="time" defaultValue="09:00" />
            <small>يستخدم للحاضر والمتأخر فقط.</small>
          </div>
          <div className="flow-field">
            <span className="flow-number">4</span>
            <label className="form-label">نوع الغياب</label>
            <select className="form-input" name="absence_type" defaultValue="unexcused">
              <option value="unexcused">بدون عذر</option>
              <option value="excused">بعذر</option>
            </select>
            <small>بدون عذر يطبق العقوبة المعتمدة.</small>
          </div>
          <div className="flow-field wide-field">
            <span className="flow-number">5</span>
            <label className="form-label">الملاحظة</label>
            <input className="form-input" name="note" placeholder="سبب الغياب أو التأخير، اختياري" />
            <small>تظهر في ملف الموظف وعند مراجعة الراتب.</small>
          </div>
          <button className="btn btn-primary btn-lg" type="submit">حفظ السجل</button>
        </form>
      </section>

      <section className="card-elevated calm-panel">
        <div className="section-heading">
          <div>
            <h2>🚫 غياب غير محسوم</h2>
            <p>بطاقات سريعة بدل الجدول: كل موظف له زر حسم مباشر بعذر أو بدون عذر.</p>
          </div>
        </div>
        {absentEmployees.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>✅</div>
            <h3 style={{ fontSize: "16px" }}>كل الغياب محسوم لهذا اليوم</h3>
          </div>
        ) : (
          <div className="absence-decision-grid">
            {absentEmployees.map((emp) => (
              <article className="absence-decision-card" key={emp.id}>
                <div>
                  <span className={`type-badge ${emp.employee_type === "crew" ? "badge-crew" : "badge-center"}`}>{emp.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}</span>
                  <h3>{emp.name}</h3>
                  <p>{emp.employee_code || "بدون كود"} · {emp.department || "بدون قسم"} · {emp.job_title || "بدون وظيفة"}</p>
                </div>
                <form action={addManualAttendance} className="absence-quick-form">
                  <input type="hidden" name="employee_id" value={emp.id} />
                  <input type="hidden" name="local_date" value={date} />
                  <input type="hidden" name="status" value="absent" />
                  <select className="form-input" name="absence_type" defaultValue="unexcused">
                    <option value="unexcused">بدون عذر</option>
                    <option value="excused">بعذر</option>
                  </select>
                  <input className="form-input" name="note" placeholder="ملاحظة مختصرة" />
                  <button className="btn btn-primary btn-sm" type="submit">حسم الغياب</button>
                  <a href={`/admin/employees/${emp.id}`} className="btn btn-ghost btn-sm">ملف</a>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-split records-split">
        <article className="card-elevated calm-panel">
          <div className="section-heading">
            <div>
              <h2>📱 سجلات QR</h2>
              <p>{qrRecords.length.toLocaleString("en-US")} سجل من الماسح.</p>
            </div>
          </div>
          {qrRecords.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">📱</div><h3>لا توجد سجلات QR</h3></div>
          ) : (
            <div className="activity-card-grid">
              {qrRecords.map((r) => (
                <article className={`activity-card ${statusClass(r)}`} key={r.id}>
                  <div className="activity-main">
                    <span className="record-icon">{statusIcon(r)}</span>
                    <div><strong>{r.employee_name}</strong><span>{r.employee_code || "بدون كود"} · {r.department || "بدون قسم"}</span></div>
                  </div>
                  <div className="activity-meta">
                    <span>{r.local_time}</span>
                    <span>{statusLabel(r)}</span>
                    <span>{r.late_minutes > 0 ? `${r.late_minutes.toLocaleString("en-US")} دقيقة` : "بدون تأخير"}</span>
                  </div>
                  <a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">ملف الموظف</a>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="card-elevated calm-panel">
          <div className="section-heading">
            <div>
              <h2>✍️ سجلات يدوية</h2>
              <p>{manualRecords.length.toLocaleString("en-US")} سجل يدوي أو غياب محسوم.</p>
            </div>
          </div>
          {manualRecords.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">✍️</div><h3>لا توجد سجلات يدوية</h3></div>
          ) : (
            <div className="activity-card-grid">
              {manualRecords.map((r) => (
                <article className={`activity-card ${statusClass(r)}`} key={r.id}>
                  <div className="activity-main">
                    <span className="record-icon">{statusIcon(r)}</span>
                    <div><strong>{r.employee_name}</strong><span>{r.employee_code || "بدون كود"} · {r.note || "بدون ملاحظة"}</span></div>
                  </div>
                  <div className="activity-meta">
                    <span>{r.status === "absent" ? "غياب" : r.local_time}</span>
                    <span>{statusLabel(r)}</span>
                    <span>{r.deduction > 0 ? `${money(r.deduction)} ${settings.currency}` : "لا خصم مباشر"}</span>
                  </div>
                  <div className="btn-row">
                    <a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">ملف</a>
                    <form action={deleteAttendanceRecord}>
                      <input type="hidden" name="record_id" value={r.id} />
                      <button className="btn btn-ghost btn-sm danger-text" type="submit">حذف</button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
