import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";
import { getEmployeeAttendance, getEmployeeMonthSummary } from "@/lib/attendance";
import { getMonthlySalaryReport } from "@/lib/report";
import { updateEmployee, regenerateQr } from "../actions";
import QRCode from "qrcode";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  employee_code: string;
  name: string;
  employee_type: string;
  department: string;
  job_title: string;
  phone: string;
  hire_date: string | null;
  bank_account: string;
  monthly_salary: number | string;
  allowance: number | string;
  qr_token: string;
  active: boolean;
};

function money(value: number | string) {
  return Number(value || 0).toLocaleString("ar-IQ");
}

function typeLabel(type: string) {
  return type === "crew" ? "موظف طاقم (يدوي)" : "موظف مركز (QR)";
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const settings = await getSettings();
  const month = query.month || currentMonth(settings.timezone);

  const db = getDb();
  const rows = await db`
    SELECT
      id,
      COALESCE(employee_code, '') AS employee_code,
      name,
      COALESCE(employee_type, 'center') AS employee_type,
      COALESCE(department, '') AS department,
      COALESCE(job_title, '') AS job_title,
      COALESCE(phone, '') AS phone,
      hire_date::text,
      COALESCE(bank_account, '') AS bank_account,
      monthly_salary,
      COALESCE(allowance, 0) AS allowance,
      qr_token,
      active
    FROM employees WHERE id = ${id}
  `;
  const emp = (rows as Employee[])[0];
  if (!emp) {
    return (
      <div className="stack">
        <div className="empty-state">
          <div className="empty-icon">❌</div>
          <h3>الموظف غير موجود</h3>
          <a href="/admin/employees" className="btn btn-primary">العودة للموظفين</a>
        </div>
      </div>
    );
  }

  const isCenter = emp.employee_type === "center";
  const qr = isCenter ? await QRCode.toDataURL(emp.qr_token, {
    width: 240, margin: 2, errorCorrectionLevel: "M",
    color: { dark: "#1e3a5f", light: "#ffffff" },
  }) : "";

  const summary = await getEmployeeMonthSummary(id, month);
  const records = await getEmployeeAttendance(id, month);
  const salaryRows = await getMonthlySalaryReport(month);
  const payroll = salaryRows.find((row) => row.employee_id === id);

  const salary = Number(emp.monthly_salary || 0);
  const allowance = Number(emp.allowance || 0);
  const grossSalary = payroll?.gross_salary ?? salary + allowance;
  const expectedWorkdays = payroll?.expected_workdays ?? Number(settings.workdays_per_month || 0);
  const absentDays = payroll?.absent_days ?? Math.max(expectedWorkdays - summary.attendance_days, 0);
  const lateDeductions = payroll?.late_deductions ?? summary.total_deductions;
  const absenceDeductions = payroll?.absence_deductions ?? 0;
  const totalDeductions = payroll?.total_deductions ?? lateDeductions;
  const netSalary = payroll?.net_salary ?? Math.max(grossSalary - totalDeductions, 0);

  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-IQ", { month: "long", year: "numeric" });

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128100; ملف الموظف</div>
          <h1>{emp.name}</h1>
          <p>
            {emp.employee_code || "بدون كود"} · {emp.department || "بدون قسم"} · {emp.job_title || "بدون وصف وظيفي"} ·
            <span className={`type-badge ${emp.employee_type === "crew" ? "badge-crew" : "badge-center"}`} style={{ marginRight: "6px" }}>
              {typeLabel(emp.employee_type)}
            </span>
          </p>
        </div>
        <Link href="/admin/employees" className="btn btn-secondary">
          → العودة للموظفين
        </Link>
      </header>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">الشهر المالي</label>
            <input className="form-input" name="month" type="month" defaultValue={month} />
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        <a href={`/api/reports/monthly.csv?month=${month}`} className="btn btn-secondary">📥 تنزيل كشف الشهر</a>
      </section>

      <section className="employee-profile-layout">
        <aside className="card-elevated profile-side-card">
          {isCenter ? (
            <>
              <div className="employee-qr profile-qr">
                <img src={qr} alt={`QR ${emp.name}`} />
              </div>
              <form action={regenerateQr}>
                <input type="hidden" name="id" value={emp.id} />
                <button className="btn btn-ghost btn-sm" type="submit" style={{ justifySelf: "center" }}>🔄 توليد QR جديد</button>
              </form>
            </>
          ) : (
            <div className="crew-profile-icon">
              <div style={{ fontSize: "64px", textAlign: "center" }}>🔧</div>
              <div style={{ textAlign: "center", color: "var(--accent-dark)", fontWeight: 700, fontSize: "16px" }}>
                موظف طاقم
              </div>
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                الحضور والرواتب تُدخل يدوياً
              </div>
            </div>
          )}
          <span className={`badge-active ${emp.active ? "on" : "off"}`} style={{ justifySelf: "center", fontSize: "14px", padding: "6px 18px" }}>
            {emp.active ? "● موظف فعّال" : "○ موظف متوقف"}
          </span>
          <div className="profile-facts">
            <div><span>الكود</span><strong>{emp.employee_code || "—"}</strong></div>
            <div><span>النوع</span><strong>{typeLabel(emp.employee_type)}</strong></div>
            <div><span>القسم</span><strong>{emp.department || "—"}</strong></div>
            <div><span>الهاتف</span><strong>{emp.phone || "—"}</strong></div>
            <div><span>المباشرة</span><strong>{emp.hire_date || "—"}</strong></div>
            <div><span>الدفع</span><strong>{emp.bank_account || "—"}</strong></div>
          </div>
        </aside>

        <div style={{ display: "grid", gap: "20px" }}>
          <div className="card-elevated">
            <div className="section-heading">
              <div>
                <h2>✏️ تعديل بيانات الموظف</h2>
                <p>هذه البيانات تُستخدم في كشف الراتب والتقارير الإدارية.</p>
              </div>
            </div>
            <form action={updateEmployee} className="professional-form-grid compact">
              <input type="hidden" name="id" value={emp.id} />
              <input type="hidden" name="employee_type" value={emp.employee_type} />
              <div className="form-group">
                <label className="form-label">كود الموظف</label>
                <input className="form-input" name="employee_code" defaultValue={emp.employee_code} readOnly style={{ background: "#f0f4ff", cursor: "not-allowed" }} />
                <span className="form-hint">يتم توليده تلقائياً ولا يمكن تعديله</span>
              </div>
              <div className="form-group">
                <label className="form-label">الاسم</label>
                <input className="form-input" name="name" defaultValue={emp.name} required />
              </div>
              <div className="form-group">
                <label className="form-label">القسم</label>
                <input className="form-input" name="department" defaultValue={emp.department} />
              </div>
              <div className="form-group">
                <label className="form-label">الوظيفة</label>
                <input className="form-input" name="job_title" defaultValue={emp.job_title} />
              </div>
              <div className="form-group">
                <label className="form-label">الهاتف</label>
                <input className="form-input" name="phone" defaultValue={emp.phone} />
              </div>
              <div className="form-group">
                <label className="form-label">تاريخ المباشرة</label>
                <input className="form-input" name="hire_date" type="date" defaultValue={emp.hire_date ?? ""} />
              </div>
              <div className="form-group">
                <label className="form-label">الراتب الأساسي ({settings.currency})</label>
                <input className="form-input" name="monthly_salary" type="number" min="0" step="0.01" defaultValue={Number(emp.monthly_salary)} />
              </div>
              <div className="form-group">
                <label className="form-label">المخصصات ({settings.currency})</label>
                <input className="form-input" name="allowance" type="number" min="0" step="0.01" defaultValue={Number(emp.allowance)} />
              </div>
              <div className="form-group full-span">
                <label className="form-label">حساب / ملاحظة مالية</label>
                <input className="form-input" name="bank_account" defaultValue={emp.bank_account} />
              </div>
              <label className="check-row">
                <input name="active" type="checkbox" defaultChecked={emp.active} />
                موظف فعّال
              </label>
              <button className="btn btn-primary" type="submit">💾 حفظ التعديل</button>
            </form>
          </div>

          <div className="card-elevated">
            <div className="section-heading">
              <div>
                <h2>💰 ملخص الراتب — {monthLabel}</h2>
                <p>الغياب يُحسب من أيام العمل الشهرية في الإعدادات، والتأخير حسب وقت بداية التأخير.</p>
              </div>
            </div>
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <article className="stat-card blue"><span className="stat-label">الراتب الأساسي</span><strong className="stat-value small-stat">{money(salary)}</strong></article>
              <article className="stat-card green"><span className="stat-label">المخصصات</span><strong className="stat-value small-stat">{money(allowance)}</strong></article>
              <article className="stat-card blue"><span className="stat-label">إجمالي المستحق</span><strong className="stat-value small-stat">{money(grossSalary)}</strong></article>
              <article className="stat-card green"><span className="stat-label">أيام الحضور</span><strong className="stat-value small-stat">{summary.attendance_days}</strong></article>
              <article className="stat-card orange"><span className="stat-label">أيام الغياب</span><strong className="stat-value small-stat">{absentDays}</strong></article>
              <article className="stat-card orange"><span className="stat-label">أيام التأخير</span><strong className="stat-value small-stat">{summary.late_days}</strong></article>
              <article className="stat-card"><span className="stat-label">خصم التأخير</span><strong className="stat-value small-stat" style={{ color: "var(--error)" }}>{money(lateDeductions)}</strong></article>
              <article className="stat-card"><span className="stat-label">خصم الغياب</span><strong className="stat-value small-stat" style={{ color: "var(--error)" }}>{money(absenceDeductions)}</strong></article>
              <article className="stat-card green"><span className="stat-label">صافي الراتب</span><strong className="stat-value small-stat" style={{ color: "var(--success)" }}>{money(netSalary)}</strong></article>
            </div>
          </div>
        </div>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>📋 سجل الحضور — {monthLabel}</h2>
            <p>الأيام المتوقعة لهذا الكشف: {expectedWorkdays.toLocaleString("ar-IQ")} يوم عمل. {isCenter ? "الحضور مسجل بواسطة QR." : "الحضور مدخل يدوياً."}</p>
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px" }}>
            <div className="empty-icon" style={{ width: "56px", height: "56px", fontSize: "24px" }}>📋</div>
            <h3 style={{ fontSize: "16px" }}>لا توجد سجلات حضور هذا الشهر</h3>
            <p style={{ fontSize: "13px" }}>
              {isCenter ? "سيظهر السجل فور تسجيل أول حضور بالـ QR" : "يمكن إدخال الحضور يدوياً من صفحة الحضور والغياب"}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>وقت الحضور</th>
                  <th>الحالة</th>
                  <th>دقائق التأخير</th>
                  <th>الخصم</th>
                  <th>المصدر</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.local_date}</td>
                    <td style={{ fontWeight: 700 }}>{r.local_time}</td>
                    <td>
                      <span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>
                        {r.status === "present" ? "✅ حاضر" : "⏰ متأخر"}
                      </span>
                    </td>
                    <td>{r.late_minutes > 0 ? `${r.late_minutes} دقيقة` : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                    <td>
                      <span className="source-badge">{(r as Record<string, unknown>).source === "manual" ? "✍️ يدوي" : "📱 QR"}</span>
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
