import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";
import { getEmployeeAttendance } from "@/lib/attendance";
import { getMonthlySalaryReport, getPayrollAdjustments } from "@/lib/report";
import { addPayrollAdjustment, deletePayrollAdjustment, regenerateQr, updateEmployee } from "../actions";
import QRCode from "qrcode";
import Link from "next/link";
import { PayrollPresetSelect } from "@/components/PayrollPresetSelect";

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
  required_workdays: number | string;
  overtime_day_rate: number | string;
  bonus_amount: number | string;
  daily_salary_mode: boolean;
  overtime_enabled: boolean;
  bonus_enabled: boolean;
  qr_token: string;
  active: boolean;
};

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
}

function typeLabel(type: string) {
  return type === "crew" ? "موظف طاقم (يدوي)" : "موظف مركز (QR)";
}

function adjustmentLabel(type: string) {
  const labels: Record<string, string> = {
    addition: "إضافة يدوية",
    task: "مهمة خارجية / بيتية",
    bonus: "مكافأة يدوية",
    deduction: "خصم يدوي",
    advance: "سلفة",
    late_deduction: "خصم تأخير",
    absence_deduction: "خصم غياب",
  };
  return labels[type] ?? type;
}

function statusLabel(record: { status: string; absence_type?: string }) {
  if (record.status === "absent") return record.absence_type === "excused" ? "🚫 غياب بعذر" : "🚫 غياب بدون عذر";
  if (record.status === "late") return "⏰ متأخر";
  return "✅ حاضر";
}

function bonusReasonText(row: Awaited<ReturnType<typeof getMonthlySalaryReport>>[number] | undefined) {
  if (!row) return "لا توجد بيانات كافية لهذا الشهر";
  if (!row.bonus_enabled) return "المكافأة غير مفعلة لهذا الموظف";
  if (row.bonus_eligible) return "مستحق: لا يوجد غياب أو تأخير أو خصم مانع";
  return row.bonus_block_reasons.length ? row.bonus_block_reasons.join("، ") : "محجوبة بسبب وجود مانع في الحضور أو القيود";
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
      COALESCE(monthly_salary, 0) AS monthly_salary,
      COALESCE(allowance, 0) AS allowance,
      COALESCE(required_workdays, 0) AS required_workdays,
      COALESCE(overtime_day_rate, 0) AS overtime_day_rate,
      COALESCE(bonus_amount, 0) AS bonus_amount,
      COALESCE(daily_salary_mode, false) AS daily_salary_mode,
      COALESCE(overtime_enabled, true) AS overtime_enabled,
      COALESCE(bonus_enabled, false) AS bonus_enabled,
      qr_token,
      active
    FROM employees WHERE id = ${id}
  `;
  const emp = (rows as Employee[])[0];
  if (!emp) {
    return (
      <div className="stack"><div className="empty-state"><div className="empty-icon">❌</div><h3>الموظف غير موجود</h3><a href="/admin/employees" className="btn btn-primary">العودة للموظفين</a></div></div>
    );
  }

  const isCenter = emp.employee_type === "center";
  const qr = isCenter ? await QRCode.toDataURL(emp.qr_token, {
    width: 240, margin: 2, errorCorrectionLevel: "M",
    color: { dark: "#1e3a5f", light: "#ffffff" },
  }) : "";

  const records = await getEmployeeAttendance(id, month);
  const salaryRows = await getMonthlySalaryReport(month);
  const payroll = salaryRows.find((row) => row.employee_id === id);
  const adjustments = await getPayrollAdjustments(month, id);
  const monthLabel = new Date(month + "-01").toLocaleDateString("ar-EG-u-nu-latn", { month: "long", year: "numeric" });

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128100; الملف المركزي</div>
          <h1>{emp.name}</h1>
          <p>كل ما يخص الموظف بمكان واحد: بياناته، حضوره، راتبه، قيوده المالية، وQR إن وجد.</p>
        </div>
        <Link href="/admin/employees" className="btn btn-secondary">→ العودة للموظفين</Link>
      </header>

      <section className="profile-command-tabs">
        <a href="#employee-profile">بطاقة الموظف</a>
        <a href="#employee-salary">تفصيل الراتب</a>
        <a href="#employee-adjustments">القيود المالية</a>
        <a href="#employee-attendance">سجل الحضور</a>
      </section>

      <section className="card report-toolbar">
        <form className="toolbar-form" method="get">
          <div className="form-group">
            <label className="form-label">الشهر المالي</label>
            <input className="form-input" name="month" type="month" defaultValue={month} />
            <span className="form-help">اختر الشهر حتى يعرض الملف حضور ورواتب هذا الشهر فقط.</span>
          </div>
          <button className="btn btn-primary" type="submit" style={{ alignSelf: "end" }}>عرض</button>
        </form>
        <a href={`/api/reports/monthly.csv?month=${month}`} className="btn btn-secondary">📥 تنزيل كشف الشهر</a>
      </section>

      <section id="employee-profile" className="employee-profile-layout">
        <aside className="card-elevated profile-side-card">
          {isCenter ? (
            <>
              <div className="employee-qr profile-qr"><img src={qr} alt={`QR ${emp.name}`} /></div>
              <form action={regenerateQr}><input type="hidden" name="id" value={emp.id} /><button className="btn btn-ghost btn-sm" type="submit">🔄 توليد QR جديد</button></form>
            </>
          ) : <div className="crew-profile-icon"><div style={{ fontSize: "64px", textAlign: "center" }}>🔧</div><div style={{ textAlign: "center", color: "var(--accent-dark)", fontWeight: 700 }}>موظف طاقم</div></div>}
          <span className={`badge-active ${emp.active ? "on" : "off"}`} style={{ justifySelf: "center", fontSize: "14px", padding: "6px 18px" }}>{emp.active ? "● موظف فعّال" : "○ موظف متوقف"}</span>
          <div className="profile-facts">
            <div><span>الكود</span><strong>{emp.employee_code || "—"}</strong></div>
            <div><span>النوع</span><strong>{typeLabel(emp.employee_type)}</strong></div>
            <div><span>الأيام المطلوبة</span><strong>{payroll?.required_workdays ?? (emp.required_workdays || "—")}</strong></div>
            <div><span>قيمة اليوم</span><strong>{money(payroll?.day_value ?? 0)}</strong></div>
            <div><span>اليوم الإضافي</span><strong>{money(payroll?.overtime_day_rate ?? Number(emp.overtime_day_rate || 0))}</strong></div>
            <div><span>الدفع</span><strong>{emp.bank_account || "—"}</strong></div>
          </div>
          {payroll?.salary_rule_warning && <div className="payroll-warning">⚠️ {payroll.salary_rule_warning}</div>}
        </aside>

        <div style={{ display: "grid", gap: "20px" }}>
          <details className="card-elevated edit-drawer profile-edit-drawer" open>
            <summary>✏️ تعديل بيانات وقواعد راتب الموظف <span>افتح/أغلق حسب الحاجة</span></summary>
            <div className="section-heading"><div><h2>بيانات وقواعد الراتب</h2><p>هذه القيم تتحكم مباشرة بمعادلة الراتب النهائي.</p></div></div>
            <div className="help-panel" style={{ marginBottom: "16px" }}><strong>قبل التعديل</strong><p>كل خانة هنا مرتبطة بالحضور أو الراتب. عند تغيير الأيام المطلوبة أو الراتب الاسمي سيتغير كشف الراتب مباشرة.</p></div>
            <form action={updateEmployee} className="professional-form-grid compact">
              <input type="hidden" name="id" value={emp.id} />
              <input type="hidden" name="employee_type" value={emp.employee_type} />
              <PayrollPresetSelect defaultPreset="custom" />
              <div className="form-group"><label className="form-label">كود الموظف</label><input className="form-input employee-code-readonly" name="employee_code" defaultValue={emp.employee_code} readOnly /><span className="form-help">كود تلقائي مرتبط بالـ QR ولا يُغيّر يدوياً.</span></div>
              <div className="form-group"><label className="form-label">الاسم</label><input className="form-input" name="name" defaultValue={emp.name} required /><span className="form-help">الاسم المعتمد في الحضور وكشف الراتب.</span></div>
              <div className="form-group"><label className="form-label">القسم</label><input className="form-input" name="department" defaultValue={emp.department} /><span className="form-help">لترتيب الموظفين حسب القسم داخل القوائم.</span></div>
              <div className="form-group"><label className="form-label">الوظيفة</label><input className="form-input" name="job_title" defaultValue={emp.job_title} /><span className="form-help">مثال: مصحح، مدرب، حسابات.</span></div>
              <div className="form-group"><label className="form-label">الهاتف</label><input className="form-input" name="phone" defaultValue={emp.phone} /><span className="form-help">رقم اختياري للتواصل يظهر داخل الملف.</span></div>
              <div className="form-group"><label className="form-label">تاريخ المباشرة</label><input className="form-input" name="hire_date" type="date" defaultValue={emp.hire_date ?? ""} /><span className="form-help">يفيد عند مراجعة من بدأ العمل خلال الشهر.</span></div>
              <div className="form-group"><label className="form-label">الراتب الاسمي ({settings.currency})</label><input className="form-input" name="monthly_salary" type="number" min="0" step="0.01" defaultValue={Number(emp.monthly_salary)} /><span className="form-help">الراتب المتفق عليه قبل الخصومات والإضافات.</span></div>
              <div className="form-group"><label className="form-label">المخصصات الثابتة ({settings.currency})</label><input className="form-input" name="allowance" type="number" min="0" step="0.01" defaultValue={Number(emp.allowance)} /><span className="form-help">مبلغ ثابت يضاف إلى الراتب كل شهر.</span></div>
              <div className="form-group"><label className="form-label">عدد الأيام المطلوبة</label><input className="form-input" name="required_workdays" type="number" min="1" max="31" step="1" defaultValue={Number(emp.required_workdays) || 30} required /><span className="form-help">عند إكمال هذا العدد يستحق الراتب الاسمي. إذا كان صفر أو فارغ سيستخدم النظام 30 يوم كقيمة آمنة.</span></div>
              <div className="form-group"><label className="form-label">أجور اليوم الإضافي ({settings.currency})</label><input className="form-input" name="overtime_day_rate" type="number" min="0" step="0.01" defaultValue={Number(emp.overtime_day_rate)} /><span className="form-help">قيمة اليوم الزائد بعد إكمال الأيام المطلوبة.</span></div>
              <div className="form-group"><label className="form-label">مبلغ المكافأة ({settings.currency})</label><input className="form-input" name="bonus_amount" type="number" min="0" step="0.01" defaultValue={Number(emp.bonus_amount)} /><span className="form-help">تُحتسب فقط عند تفعيل المكافأة وعدم وجود موانع.</span></div>
              <div className="form-group"><label className="form-label">خيارات الراتب</label><label className="check-row"><input name="overtime_enabled" type="checkbox" defaultChecked={emp.overtime_enabled} /> احتساب الأيام الإضافية</label><label className="check-row"><input name="bonus_enabled" type="checkbox" defaultChecked={emp.bonus_enabled} /> تفعيل المكافأة التلقائية</label><label className="check-row"><input name="daily_salary_mode" type="checkbox" defaultChecked={emp.daily_salary_mode} /> حساب راتب يومي حسب الحضور</label><span className="form-help">فعّل فقط القواعد المناسبة لعقد هذا الموظف.</span></div>
              <div className="form-group full-span"><label className="form-label">حساب / ملاحظة مالية</label><input className="form-input" name="bank_account" defaultValue={emp.bank_account} /><span className="form-help">رقم حساب أو محفظة أو ملاحظة دفع خاصة بالموظف.</span></div>
              <label className="check-row"><input name="active" type="checkbox" defaultChecked={emp.active} /> موظف فعّال</label>
              <button className="btn btn-primary" type="submit">💾 حفظ التعديل</button>
            </form>
          </details>

          <div id="employee-salary" className="card-elevated">
            <div className="section-heading"><div><h2>💰 تفصيل الراتب — {monthLabel}</h2><p>محرك الراتب الجديد: اسمي + إضافي + مكافآت + مهام − غيابات/تأخير/خصومات.</p></div></div>
            {payroll?.salary_rule_warning && <div className="payroll-warning">⚠️ {payroll.salary_rule_warning}</div>}
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <article className="stat-card blue"><span className="stat-label">الراتب المحتسب</span><strong className="stat-value small-stat">{money(payroll?.salary_base_calculated ?? emp.monthly_salary)}</strong></article>
              <article className="stat-card green"><span className="stat-label">الحضور / المطلوب</span><strong className="stat-value small-stat">{payroll?.attendance_days ?? 0} / {payroll?.required_workdays ?? 0}</strong></article>
              <article className="stat-card blue"><span className="stat-label">الأيام الإضافية</span><strong className="stat-value small-stat">{payroll?.extra_days ?? 0}</strong></article>
              <article className="stat-card green"><span className="stat-label">أجور الإضافي</span><strong className="stat-value small-stat">{money(payroll?.overtime_amount ?? 0)}</strong></article>
              <article className="stat-card orange"><span className="stat-label">غياب بعذر / بدون</span><strong className="stat-value small-stat">{payroll?.absent_excused_days ?? 0} / {payroll?.absent_unexcused_days ?? 0}</strong></article>
              <article className="stat-card"><span className="stat-label">خصم الغياب</span><strong className="stat-value small-stat" style={{ color: "var(--error)" }}>{money(payroll?.absence_deductions ?? 0)}</strong></article>
              <article className="stat-card"><span className="stat-label">خصم التأخير</span><strong className="stat-value small-stat" style={{ color: "var(--error)" }}>{money(payroll?.late_deductions ?? 0)}</strong></article>
              <article className="stat-card green"><span className="stat-label">المكافأة التلقائية</span><strong className="stat-value small-stat">{money(payroll?.automatic_bonus ?? 0)}</strong></article>
              <article className="stat-card green"><span className="stat-label">صافي الراتب</span><strong className="stat-value small-stat" style={{ color: "var(--success)" }}>{money(payroll?.net_salary ?? 0)}</strong></article>
            </div>
            <div className="salary-equation salary-equation-detailed full-salary-equation">
              <span>الراتب المحتسب {money(payroll?.salary_base_calculated ?? emp.monthly_salary)}</span>
              <span>+ المخصصات {money(payroll?.allowance ?? emp.allowance)}</span>
              <span>+ الإضافي {money(payroll?.overtime_amount ?? 0)}</span>
              <span>+ المكافأة التلقائية {money(payroll?.automatic_bonus ?? 0)}</span>
              <span>+ المهام/الإضافات {money(payroll?.manual_additions ?? 0)}</span>
              <span>- خصم الغياب {money(payroll?.absence_deductions ?? 0)}</span>
              <span>- خصم التأخير {money(payroll?.late_deductions ?? 0)}</span>
              <span>- السلف/الخصومات {money(payroll?.manual_deductions ?? 0)}</span>
              <strong>= {money(payroll?.net_salary ?? 0)} {settings.currency}</strong>
            </div>
            <div className={`bonus-status-box ${payroll?.bonus_eligible ? "is-ok" : payroll?.bonus_enabled ? "is-blocked" : "is-off"}`}>
              <strong>{payroll?.bonus_eligible ? "✅ المكافأة مستحقة" : payroll?.bonus_enabled ? "🚫 المكافأة محجوبة" : "— المكافأة غير مفعلة"}</strong>
              <span>{bonusReasonText(payroll)}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="employee-adjustments" className="card-elevated">
        <div className="section-heading"><div><h2>➕ قيود مالية للشهر — {monthLabel}</h2><p>كل خصم أو مكافأة أو مهمة خارجية يجب أن يكون معها ملاحظة.</p></div></div>
        <form action={addPayrollAdjustment} className="professional-form-grid compact">
          <input type="hidden" name="employee_id" value={emp.id} />
          <input type="hidden" name="month" value={month} />
          <div className="form-group"><label className="form-label">النوع</label><select className="form-input" name="type" defaultValue="deduction"><option value="deduction">خصم يدوي</option><option value="advance">سلفة</option><option value="late_deduction">خصم تأخير</option><option value="absence_deduction">خصم غياب</option><option value="addition">إضافة يدوية</option><option value="task">مهمة خارجية / بيتية</option><option value="bonus">مكافأة يدوية</option></select><span className="form-help">اختر هل القيد يزيد الراتب أو ينقصه.</span></div>
          <div className="form-group"><label className="form-label">المبلغ ({settings.currency})</label><input className="form-input" name="amount" type="number" min="0" step="0.01" required /><span className="form-help">اكتب المبلغ بالإنكليزي فقط، مثال: 25000.</span></div>
          <div className="form-group full-span"><label className="form-label">الملاحظة</label><input className="form-input" name="note" required placeholder="مثال: مهمة تصحيح بيتية / سلفة / خصم إداري" /><span className="form-help">الملاحظة إلزامية حتى يكون سبب القيد واضحاً عند المراجعة.</span></div>
          <label className="check-row"><input name="affects_bonus" type="checkbox" defaultChecked /> هذا الخصم يمنع المكافأة التلقائية</label>
          <button className="btn btn-primary" type="submit">إضافة القيد</button>
        </form>

        {adjustments.length > 0 && (
          <div className="table-wrap" style={{ marginTop: "18px" }}>
            <table>
              <thead><tr><th>النوع</th><th>المبلغ</th><th>الملاحظة</th><th>يمنع المكافأة</th><th>حذف</th></tr></thead>
              <tbody>
                {adjustments.map((item) => (
                  <tr key={item.id}>
                    <td>{adjustmentLabel(item.type)}</td>
                    <td style={{ fontWeight: 800 }}>{money(item.amount)} {settings.currency}</td>
                    <td>{item.note}</td>
                    <td>{item.affects_bonus ? "نعم" : "لا"}</td>
                    <td><form action={deletePayrollAdjustment}><input type="hidden" name="adjustment_id" value={item.id} /><input type="hidden" name="employee_id" value={emp.id} /><button className="btn btn-ghost btn-sm" type="submit" style={{ color: "var(--error)" }}>🗑️</button></form></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="employee-attendance" className="card-elevated">
        <div className="section-heading"><div><h2>📋 سجل الحضور والغياب — {monthLabel}</h2><p>الغيابات هنا تدخل مباشرة في حساب الراتب حسب ترتيبها الزمني.</p></div></div>
        {records.length === 0 ? (
          <div className="empty-state" style={{ padding: "30px" }}><div className="empty-icon">📋</div><h3>لا توجد سجلات لهذا الشهر</h3></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>التاريخ</th><th>وقت الحضور</th><th>الحالة</th><th>دقائق التأخير</th><th>خصم التأخير</th><th>الملاحظة</th><th>المصدر</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.local_date}</td>
                    <td style={{ fontWeight: 700 }}>{r.status === "absent" ? "—" : r.local_time}</td>
                    <td><span className={`badge-active ${r.status === "present" ? "on" : "off"}`}>{statusLabel(r)}</span></td>
                    <td>{r.late_minutes > 0 ? `${r.late_minutes} دقيقة` : "—"}</td>
                    <td>{r.deduction > 0 ? <span style={{ color: "var(--error)", fontWeight: 700 }}>{money(r.deduction)}</span> : "—"}</td>
                    <td>{r.note || "—"}</td>
                    <td><span className="source-badge">{r.source === "manual" ? "✍️ يدوي" : "📱 QR"}</span></td>
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
