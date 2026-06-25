import { createEmployee, regenerateQr, updateEmployee } from "./actions";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getMonthlySalaryReport } from "@/lib/report";
import { currentMonth } from "@/lib/time";
import QRCode from "qrcode";

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

type EmployeeWithDetails = Employee & {
  qr: string;
  attendance_days: number;
  absent_days: number;
  late_days: number;
  total_deductions: number;
  gross_salary: number;
  net_salary: number;
  required_workdays_report: number;
  extra_days: number;
  overtime_amount: number;
  automatic_bonus: number;
};

async function qrDataUrl(token: string) {
  return QRCode.toDataURL(token, {
    width: 200, margin: 2, errorCorrectionLevel: "M",
    color: { dark: "#1e3a5f", light: "#ffffff" },
  });
}

function money(value: number | string) {
  return Number(value || 0).toLocaleString("en-US");
}

function typeLabel(type: string) {
  return type === "crew" ? "طاقم" : "مركز";
}

function typeBadgeClass(type: string) {
  return type === "crew" ? "badge-crew" : "badge-center";
}

export default async function EmployeesPage() {
  const settings = await getSettings();
  const month = currentMonth(settings.timezone);
  let employees: EmployeeWithDetails[] = [];

  try {
    const db = getDb();
    const rows = (await db`
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
        COALESCE(required_workdays, 0) AS required_workdays,
        COALESCE(overtime_day_rate, 0) AS overtime_day_rate,
        COALESCE(bonus_amount, 0) AS bonus_amount,
        COALESCE(daily_salary_mode, false) AS daily_salary_mode,
        COALESCE(overtime_enabled, true) AS overtime_enabled,
        COALESCE(bonus_enabled, false) AS bonus_enabled,
        qr_token,
        active
      FROM employees
      ORDER BY active DESC, employee_type ASC, department ASC NULLS LAST, name ASC
    `) as Employee[];

    const salaryRows = await getMonthlySalaryReport(month);
    const payroll = new Map(salaryRows.map((row) => [row.employee_id, row]));

    employees = await Promise.all(
      rows.map(async (emp) => {
        const qr = emp.employee_type === "center" ? await qrDataUrl(emp.qr_token) : "";
        const salary = Number(emp.monthly_salary || 0);
        const allowance = Number(emp.allowance || 0);
        const report = payroll.get(emp.id);
        return {
          ...emp,
          qr,
          attendance_days: report?.attendance_days ?? 0,
          absent_days: report?.absent_days ?? 0,
          late_days: report?.late_days ?? 0,
          total_deductions: report?.total_deductions ?? 0,
          gross_salary: report?.gross_salary ?? salary + allowance,
          net_salary: report?.net_salary ?? salary + allowance,
          required_workdays_report: report?.required_workdays ?? Number(emp.required_workdays || 0),
          extra_days: report?.extra_days ?? 0,
          overtime_amount: report?.overtime_amount ?? 0,
          automatic_bonus: report?.automatic_bonus ?? 0,
        };
      })
    );
  } catch {
    // DB not ready
  }

  const activeCount = employees.filter((emp) => emp.active).length;
  const centerCount = employees.filter((emp) => emp.active && emp.employee_type === "center").length;
  const crewCount = employees.filter((emp) => emp.active && emp.employee_type === "crew").length;
  const departments = new Set(employees.map((emp) => emp.department).filter(Boolean)).size;
  const payrollTotal = employees.filter((emp) => emp.active).reduce((sum, emp) => sum + emp.net_salary, 0);

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#128101; الموظفون</div>
          <h1>إدارة الموظفين والملفات الوظيفية</h1>
          <p>ملفات موظفين احترافية — كود تلقائي، نوع الموظف، القسم، الراتب، المخصصات، QR للحضور، أو إدخال يدوي</p>
        </div>
        <a href="/admin/salaries" className="btn btn-accent">💰 كشف الرواتب</a>
      </header>

      <section className="stats-grid">
        <article className="stat-card blue">
          <div className="stat-icon blue">👥</div>
          <span className="stat-label">الموظفون الفعالون</span>
          <strong className="stat-value">{activeCount.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card green">
          <div className="stat-icon green">🏢</div>
          <span className="stat-label">موظفو المركز (QR)</span>
          <strong className="stat-value">{centerCount.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card orange">
          <div className="stat-icon orange">🔧</div>
          <span className="stat-label">موظفو الطاقم (يدوي)</span>
          <strong className="stat-value">{crewCount.toLocaleString("en-US")}</strong>
        </article>
        <article className="stat-card">
          <div className="stat-icon" style={{ background: "#f0f4ff", color: "#3b82f6" }}>💵</div>
          <span className="stat-label">صافي الرواتب</span>
          <strong className="stat-value">{payrollTotal.toLocaleString("en-US")} {settings.currency}</strong>
        </article>
      </section>

      <section className="card-elevated">
        <div className="section-heading">
          <div>
            <h2>➕ إضافة موظف جديد</h2>
            <p>سيتم توليد كود الموظف تلقائياً (HF_Employee_001, 002, ...). موظفو المركز يحضرون بالـ QR، وموظفو الطاقم يدوياً.</p>
          </div>
        </div>
        <div className="ux-guide">
          <div><strong>1. عرّف الموظف</strong><span>اختَر نوع الموظف ثم اكتب الاسم والقسم والوظيفة حتى تظهر التقارير مرتبة.</span></div>
          <div><strong>2. ثبّت قاعدة الراتب</strong><span>الراتب الاسمي + الأيام المطلوبة هي أساس كل معادلات الراتب.</span></div>
          <div><strong>3. فعّل الخيارات المناسبة</strong><span>الإضافي والمكافأة واليومي تُحسب فقط عند تفعيلها هنا.</span></div>
        </div>
        <form action={createEmployee} className="professional-form-grid" style={{ marginTop: "18px" }}>
          <div className="form-section-title">👤 معلومات الموظف <span>هذه البيانات تظهر في كل الشاشات والتقارير.</span></div>
          <div className="form-group">
            <label className="form-label">نوع الموظف</label>
            <select className="form-input" name="employee_type" required>
              <option value="center">🏢 موظف مركز — حضور بالـ QR</option>
              <option value="crew">🔧 موظف طاقم — حضور ورواتب يدوية</option>
            </select>
            <span className="form-help">مركز: يظهر له QR للحضور. طاقم: حضوره ورواتبه تدخل يدوياً عند الحاجة.</span>
          </div>
          <div className="form-group">
            <label className="form-label">اسم الموظف</label>
            <input className="form-input" name="name" required placeholder="مثال: أحمد علي" />
            <span className="form-help">اكتب الاسم كما تريد ظهوره في كشف الحضور والراتب.</span>
          </div>
          <div className="form-group">
            <label className="form-label">القسم</label>
            <input className="form-input" name="department" placeholder="مثال: الإدارة" />
            <span className="form-help">يساعد على فلترة الموظفين حسب القسم داخل التقارير.</span>
          </div>
          <div className="form-group">
            <label className="form-label">الوظيفة</label>
            <input className="form-input" name="job_title" placeholder="مثال: محاسب" />
            <span className="form-help">اكتب العنوان الوظيفي مثل مصحح، مدرب، حسابات.</span>
          </div>
          <div className="form-group">
            <label className="form-label">رقم الهاتف</label>
            <input className="form-input" name="phone" placeholder="07xx xxx xxxx" />
            <span className="form-help">اختياري، يظهر داخل بطاقة الموظف فقط.</span>
          </div>
          <div className="form-group">
            <label className="form-label">تاريخ المباشرة</label>
            <input className="form-input" name="hire_date" type="date" />
            <span className="form-help">يفيد لمعرفة بداية عمل الموظف، خصوصاً عند الحساب اليومي.</span>
          </div>
          <div className="form-section-title">💰 قاعدة الراتب <span>هذه الحقول تدخل مباشرة في معادلة الراتب النهائي.</span></div>
          <div className="form-group">
            <label className="form-label">الراتب الأساسي ({settings.currency})</label>
            <input className="form-input" name="monthly_salary" type="number" min="0" step="0.01" defaultValue="0" />
            <span className="form-help">الراتب الاسمي قبل الإضافي والخصومات والمكافآت.</span>
          </div>
          <div className="form-group">
            <label className="form-label">المخصصات ({settings.currency})</label>
            <input className="form-input" name="allowance" type="number" min="0" step="0.01" defaultValue="0" />
            <span className="form-help">مبلغ ثابت يُضاف كل شهر فوق الراتب الاسمي.</span>
          </div>
          <div className="form-group">
            <label className="form-label">عدد الأيام المطلوبة</label>
            <input className="form-input" name="required_workdays" type="number" min="0" step="1" defaultValue="16" />
            <span className="form-help">مثال المصححين: 16، الدوام الكامل: 30. عند إكمالها يستحق الراتب الاسمي.</span>
          </div>
          <div className="form-group">
            <label className="form-label">أجور اليوم الإضافي ({settings.currency})</label>
            <input className="form-input" name="overtime_day_rate" type="number" min="0" step="0.01" defaultValue="25" />
            <span className="form-help">يُحسب فقط عند حضور أيام أكثر من الأيام المطلوبة.</span>
          </div>
          <div className="form-group">
            <label className="form-label">مبلغ المكافأة ({settings.currency})</label>
            <input className="form-input" name="bonus_amount" type="number" min="0" step="0.01" defaultValue="0" />
            <span className="form-help">تُضاف تلقائياً فقط إذا كان الموظف مستحقاً للمكافأة.</span>
          </div>
          <div className="form-section-title">⚙️ طريقة الاحتساب <span>اختيارات سريعة تغيّر طريقة الحساب بدون تعديل المعادلة.</span></div>
          <div className="form-group"> 
            <label className="form-label">قواعد الاحتساب</label>
            <label className="check-row"><input name="overtime_enabled" type="checkbox" defaultChecked /> احتساب الأيام الإضافية</label>
            <label className="check-row"><input name="bonus_enabled" type="checkbox" /> تفعيل المكافأة التلقائية</label>
            <label className="check-row"><input name="daily_salary_mode" type="checkbox" /> حساب راتب يومي حسب الحضور</label>
            <span className="form-help">فعّل اليومي فقط لمن بدأ من نص الشهر أو لا يستحق الراتب القطعي.</span>
          </div>
          <div className="form-group full-span">
            <label className="form-label">حساب / ملاحظة مالية</label>
            <input className="form-input" name="bank_account" placeholder="اختياري: رقم حساب، محفظة، أو ملاحظة دفع" />
            <span className="form-help">أي معلومة دفع أو ملاحظة مالية خاصة بهذا الموظف.</span>
          </div>
          <button className="btn btn-primary btn-lg" type="submit" style={{ alignSelf: "end" }}>
            إضافة الموظف
          </button>
        </form>
      </section>

      {employees.length === 0 ? (
        <section className="card">
          <div className="empty-state">
            <div className="empty-icon">👤</div>
            <h3>لا يوجد موظفون بعد</h3>
            <p>أضف أول موظف وسيبدأ النظام بحساب الحضور والراتب بشكل تلقائي.</p>
          </div>
        </section>
      ) : (
        <section className="employee-grid professional-employee-grid">
          {employees.map((emp) => (
            <article className={`employee-card ${emp.active ? "" : "muted"}`} key={emp.id}>
              <div className="employee-top">
                {emp.employee_type === "center" ? (
                  <div className="employee-qr">
                    <img src={emp.qr} alt={`QR ${emp.name}`} />
                  </div>
                ) : (
                  <div className="employee-qr employee-qr-crew">
                    <div className="crew-icon-large">🔧</div>
                    <span>طاقم</span>
                  </div>
                )}
                <div className="employee-info">
                  <div className="mini-muted">
                    {emp.employee_code || "بدون كود"} · {emp.department || "بدون قسم"}
                  </div>
                  <h2>
                    <a href={`/admin/employees/${emp.id}`} style={{ color: "var(--primary-dark)" }}>
                      {emp.name}
                    </a>
                  </h2>
                  <span className="job-title">{emp.job_title || "بدون وصف وظيفي"}</span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span className={`badge-active ${emp.active ? "on" : "off"}`}>
                      {emp.active ? "● فعّال" : "○ متوقف"}
                    </span>
                    <span className={`type-badge ${typeBadgeClass(emp.employee_type)}`}>
                      {emp.employee_type === "crew" ? "🔧 طاقم" : "🏢 مركز"}
                    </span>
                    {emp.phone && <span className="soft-badge">📞 {emp.phone}</span>}
                  </div>
                </div>
              </div>

              <div className="metric-strip">
                <div><span>المطلوب</span><strong>{emp.required_workdays_report}</strong></div>
                <div><span>حضور</span><strong>{emp.attendance_days}</strong></div>
                <div><span>إضافي</span><strong>{emp.extra_days}</strong></div>
                <div><span>الصافي</span><strong>{money(emp.net_salary)}</strong></div>
              </div>

              <hr className="divider" />

              <form action={updateEmployee} className="mini-form">
                <input type="hidden" name="id" value={emp.id} />
                <input type="hidden" name="employee_type" value={emp.employee_type} />
                <div className="help-panel"><strong>تعديل سريع</strong><p>أي تغيير هنا ينعكس مباشرة على الحضور والرواتب. الحقول المالية تُستخدم في كشف الشهر الحالي والجديد.</p></div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الكود</label>
                    <input className="form-input" name="employee_code" defaultValue={emp.employee_code} readOnly style={{ background: "#f0f4ff", cursor: "not-allowed" }} />
                    <span className="form-help">يتولد تلقائياً ولا يُعدّل يدوياً حتى يبقى QR ثابت.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">الاسم</label>
                    <input className="form-input" name="name" defaultValue={emp.name} required />
                    <span className="form-help">اسم الموظف الظاهر في كل التقارير.</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">القسم</label>
                    <input className="form-input" name="department" defaultValue={emp.department} />
                    <span className="form-help">لتنظيم العرض حسب القسم.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">الوظيفة</label>
                    <input className="form-input" name="job_title" defaultValue={emp.job_title} />
                    <span className="form-help">مثال: مصحح، مدرب، حسابات.</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الهاتف</label>
                    <input className="form-input" name="phone" defaultValue={emp.phone} />
                    <span className="form-help">اختياري للتواصل.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المباشرة</label>
                    <input className="form-input" name="hire_date" type="date" defaultValue={emp.hire_date ?? ""} />
                    <span className="form-help">مفيد عند حساب جزء من الشهر.</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الراتب</label>
                    <input className="form-input" name="monthly_salary" type="number" min="0" step="0.01" defaultValue={Number(emp.monthly_salary)} />
                    <span className="form-help">الراتب الاسمي قبل أي زيادة أو خصم.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">المخصصات</label>
                    <input className="form-input" name="allowance" type="number" min="0" step="0.01" defaultValue={Number(emp.allowance)} />
                    <span className="form-help">إضافة ثابتة كل شهر.</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">الأيام المطلوبة</label>
                    <input className="form-input" name="required_workdays" type="number" min="0" step="1" defaultValue={Number(emp.required_workdays)} />
                    <span className="form-help">بعد إكمالها يستحق الراتب الاسمي.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">اليوم الإضافي</label>
                    <input className="form-input" name="overtime_day_rate" type="number" min="0" step="0.01" defaultValue={Number(emp.overtime_day_rate)} />
                    <span className="form-help">قيمة كل يوم حضور فوق المطلوب.</span>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">مبلغ المكافأة</label>
                    <input className="form-input" name="bonus_amount" type="number" min="0" step="0.01" defaultValue={Number(emp.bonus_amount)} />
                    <span className="form-help">تظهر فقط إذا تحققت شروط المكافأة.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">خيارات الراتب</label>
                    <label className="check-row"><input name="overtime_enabled" type="checkbox" defaultChecked={emp.overtime_enabled} /> إضافي</label>
                    <label className="check-row"><input name="bonus_enabled" type="checkbox" defaultChecked={emp.bonus_enabled} /> مكافأة</label>
                    <label className="check-row"><input name="daily_salary_mode" type="checkbox" defaultChecked={emp.daily_salary_mode} /> يومي</label>
                    <span className="form-help">الإضافي/المكافأة/اليومي يمكن تفعيلها لكل موظف لوحده.</span>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">حساب / ملاحظة مالية</label>
                  <input className="form-input" name="bank_account" defaultValue={emp.bank_account} />
                  <span className="form-help">رقم حساب أو محفظة أو ملاحظة دفع.</span>
                </div>
                <div className="employee-actions">
                  <label className="check-row">
                    <input name="active" type="checkbox" defaultChecked={emp.active} />
                    موظف فعّال
                  </label>
                  <button className="btn btn-primary btn-sm" type="submit">💾 حفظ</button>
                  <a href={`/admin/employees/${emp.id}`} className="btn btn-secondary btn-sm">📄 الملف</a>
                </div>
              </form>
              {emp.employee_type === "center" && (
                <form action={regenerateQr}>
                  <input type="hidden" name="id" value={emp.id} />
                  <button className="btn btn-ghost btn-sm" type="submit">🔄 توليد QR جديد</button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
