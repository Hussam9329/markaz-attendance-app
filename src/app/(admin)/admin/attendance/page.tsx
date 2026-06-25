import { getSettings } from "@/lib/settings";
import { getLocalParts } from "@/lib/time";
import { getAbsentEmployeesByDate, getActiveEmployees, getAttendanceByDate, getDaySummary } from "@/lib/attendance";
import { addManualAttendance, deleteAttendanceRecord } from "../employees/actions";

export const dynamic = "force-dynamic";

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
}

function statusLabel(record: { status: string; absence_type?: string }) {
  if (record.status === "absent") return record.absence_type === "excused" ? "🚫 غياب بعذر" : "🚫 غياب بدون عذر";
  if (record.status === "late") return "⏰ متأخر";
  return "✅ حاضر";
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
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128203; الحضور</div>
          <h1>متابعة الحضور والغياب اليومي</h1>
          <p>عرض الحاضرين، المتأخرين، والغائبين بعذر وبدون عذر — {dateFormatted}</p>
        </div>
        <a className="btn btn-accent" href="/" target="_blank">📱 ماسح QR للمركز</a>
      </header>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">اختر التاريخ</label>
            <input className="form-input" name="date" type="date" defaultValue={date} />
            <span className="form-help">غيّر التاريخ لمراجعة حضور يوم سابق أو تسجيل غياب متأخر.</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        {date !== today && <a href="/admin/attendance" className="btn btn-secondary">اليوم</a>}
      </section>

      <section className="ux-guide">
        <div><strong>QR</strong><span>يسجل حضور المركز تلقائياً ويحسب التأخير حسب الإعدادات.</span></div>
        <div><strong>إدخال يدوي</strong><span>استخدمه للحضور الاستثنائي أو للطاقم أو للغياب بعذر/بدون عذر.</span></div>
        <div><strong>غياب غير محسوم</strong><span>أي موظف بلا سجل يظهر هنا حتى تحدد نوع الغياب قبل الراتب.</span></div>
      </section>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">📊</div>
          <span className="stat-label">نسبة الحضور الفعلية</span>
          <strong className="stat-value">{attendanceRate.toLocaleString("en-US")}%</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">✅</div>
          <span className="stat-label">حضور ضمن الوقت</span>
          <strong className="stat-value">{summary.present_count.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">⏰</div>
          <span className="stat-label">متأخرون</span>
          <strong className="stat-value">{summary.late_count.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#fff5f5", color: "#e53e3e" }}>🚫</div>
          <span className="stat-label">غياب مسجل / غير محسوم</span>
          <strong className="stat-value">{summary.absent_count.toLocaleString("en-US")} / {absentEmployees.length.toLocaleString("en-US")}</strong>
        </article>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>✍️ إدخال حضور / غياب يدوي</h2>
            <p>أي غياب يتم تسجيله هنا يدخل مباشرة في كشف الرواتب ويُحسب حسب: بعذر، بدون عذر، قبل/بعد إكمال الأيام المطلوبة.</p>
          </div>
        </div>
        <form action={addManualAttendance} className="professional-form-grid compact">
          <input type="hidden" name="local_date" value={date} />
          <div className="form-group">
            <label className="form-label">الموظف</label>
            <select className="form-input" name="employee_id" required>
              <option value="">— اختر الموظف —</option>
              {manualEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.employee_code} — {emp.name} ({emp.department || "بدون قسم"})</option>
              ))}
            </select>
            <span className="form-help">اختر الموظف الذي تريد إضافة سجل يدوي له في هذا التاريخ.</span>
          </div>
          <div className="form-group">
            <label className="form-label">وقت الحضور</label>
            <input className="form-input" name="local_time" type="time" defaultValue="09:00" />
            <span className="form-help">اكتب وقت الحضور للحاضر أو المتأخر. يُتجاهل عند اختيار غياب.</span>
          </div>
          <div className="form-group">
            <label className="form-label">الحالة</label>
            <select className="form-input" name="status" defaultValue="present">
              <option value="present">✅ حاضر</option>
              <option value="late">⏰ متأخر</option>
              <option value="absent">🚫 غائب</option>
            </select>
            <span className="form-help">اختر حاضر، متأخر، أو غائب. هذه الحالة تدخل في التقارير.</span>
          </div>
          <div className="form-group">
            <label className="form-label">نوع الغياب</label>
            <select className="form-input" name="absence_type" defaultValue="unexcused">
              <option value="unexcused">بدون عذر</option>
              <option value="excused">بعذر</option>
            </select>
            <span className="form-help">بعذر يخصم حسب القاعدة، وبدون عذر يطبق عقوبة الغياب.</span>
          </div>
          <div className="form-group full-span">
            <label className="form-label">ملاحظة</label>
            <input className="form-input" name="note" placeholder="سبب الغياب أو التأخير، اختياري" />
            <span className="form-help">الملاحظة تظهر في ملف الموظف وتساعد عند مراجعة الراتب.</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>✍️ تسجيل يدوي</button>
        </form>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>📱 سجلات حضور QR — {dateFormatted}</h2>
            <p>إجمالي خصومات التأخير المسجلة من البصمة: {money(summary.total_deductions)} {settings.currency}</p>
          </div>
        </div>
        {qrRecords.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📱</div><h3>لا توجد سجلات QR في هذا التاريخ</h3></div>
        ) : (
          <div className="table-wrap">
            <p className="table-note">كل سجل QR هنا مسجل تلقائياً من الماسح. السجل اليدوي يظهر في جدول منفصل حتى يكون التمييز واضح.</p>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>الكود</th><th>الموظف</th><th>القسم</th><th>الوظيفة</th><th>وقت الحضور</th><th>الحالة</th><th>دقائق التأخير</th><th>الخصم</th><th>الملف</th>
                </tr>
              </thead>
              <tbody>
                {qrRecords.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.employee_name}</td>
                    <td>{r.department || "—"}</td>
                    <td>{r.job_title || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.local_time}</td>
                    <td><span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>{statusLabel(r)}</span></td>
                    <td>{r.late_minutes > 0 ? <span style={{ color: "var(--warning)", fontWeight: 700 }}>{r.late_minutes} دقيقة</span> : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                    <td><a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">📄</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {manualRecords.length > 0 && (
        <section className="card-elevated">
          <div className="section-heading">
            <div>
              <h2>✍️ السجلات اليدوية — {dateFormatted}</h2>
              <p>تشمل الحضور اليدوي والغيابات بعذر/بدون عذر.</p>
            </div>
          </div>
          <div className="table-wrap">
            <p className="table-note">راجع نوع الغياب والملاحظة قبل نهاية الشهر، لأنهما يدخلان مباشرة في محرك الرواتب.</p>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>الكود</th><th>الموظف</th><th>القسم</th><th>الوظيفة</th><th>وقت الحضور</th><th>الحالة</th><th>دقائق التأخير</th><th>الخصم</th><th>الملاحظة</th><th>الملف</th><th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {manualRecords.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td>{r.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.employee_name}</td>
                    <td>{r.department || "—"}</td>
                    <td>{r.job_title || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{r.status === "absent" ? "—" : r.local_time}</td>
                    <td><span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>{statusLabel(r)}</span></td>
                    <td>{r.late_minutes > 0 ? <span style={{ color: "var(--warning)", fontWeight: 700 }}>{r.late_minutes} دقيقة</span> : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                    <td>{r.note || "—"}</td>
                    <td><a href={`/admin/employees/${r.employee_id}`} className="btn btn-ghost btn-sm">📄</a></td>
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

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>🚫 غياب غير محسوم</h2>
            <p>هؤلاء لا يملكون أي سجل لهذا اليوم. سجّل الغياب حتى يدخل في الراتب بنوعه الصحيح.</p>
          </div>
        </div>
        {absentEmployees.length === 0 ? (
          <div className="empty-state" style={{ padding: "28px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>✅</div>
            <h3 style={{ fontSize: "16px" }}>لا توجد غيابات غير محسومة</h3>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>الكود</th><th>الموظف</th><th>النوع</th><th>القسم</th><th>الوظيفة</th><th>الهاتف</th><th>الملف</th><th>تسجيل سريع</th></tr>
              </thead>
              <tbody>
                {absentEmployees.map((emp, i) => (
                  <tr key={emp.id}>
                    <td>{i + 1}</td>
                    <td>{emp.employee_code || "—"}</td>
                    <td style={{ fontWeight: 700 }}>{emp.name}</td>
                    <td><span className={`type-badge ${emp.employee_type === "crew" ? "badge-crew" : "badge-center"}`}>{emp.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}</span></td>
                    <td>{emp.department || "—"}</td>
                    <td>{emp.job_title || "—"}</td>
                    <td>{emp.phone || "—"}</td>
                    <td><a href={`/admin/employees/${emp.id}`} className="btn btn-ghost btn-sm">📄</a></td>
                    <td>
                      <form action={addManualAttendance} style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <input type="hidden" name="employee_id" value={emp.id} />
                        <input type="hidden" name="local_date" value={date} />
                        <input type="hidden" name="status" value="absent" />
                        <select className="form-input" name="absence_type" defaultValue="unexcused" style={{ minWidth: "130px", padding: "8px" }}>
                          <option value="unexcused">بدون عذر</option>
                          <option value="excused">بعذر</option>
                        </select>
                        <input className="form-input" name="note" placeholder="ملاحظة" style={{ minWidth: "140px", padding: "8px" }} />
                        <button className="btn btn-primary btn-sm" type="submit">تسجيل</button>
                      </form>
                    </td>
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
