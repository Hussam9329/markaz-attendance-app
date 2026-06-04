import { getSettings } from "@/lib/settings";
import { updateSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <div className="page-tag">&#9881; الإعدادات</div>
          <h1>إعدادات المركز</h1>
          <p>تحديد قواعد الخصم والتأخير والعملة لجميع الموظفين</p>
        </div>
      </header>

      <section className="card-elevated">
        <form action={updateSettings} className="settings-form">
          <div className="form-group">
            <label className="form-label">اسم المركز في الواجهة</label>
            <input className="form-input" name="center_name" defaultValue={settings.center_name} required />
            <span className="form-hint">يظهر في واجهة التابلت الرئيسية</span>
          </div>

          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">المنطقة الزمنية</label>
              <input className="form-input" name="timezone" defaultValue={settings.timezone} required />
              <span className="form-hint">الافتراضية: Asia/Baghdad</span>
            </div>

            <div className="form-group">
              <label className="form-label">العملة / رمز الراتب</label>
              <input className="form-input" name="currency" defaultValue={settings.currency} required />
              <span className="form-hint">مثال: IQD — دينار عراقي</span>
            </div>
          </div>

          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">وقت بداية التأخير</label>
              <input
                className="form-input"
                name="late_after_time"
                type="time"
                step="1"
                defaultValue={settings.late_after_time}
                required
              />
              <span className="form-hint">أي حضور بعد هذا الوقت يُحسب تأخيراً</span>
            </div>

            <div className="form-group">
              <label className="form-label">مبلغ الخصم لكل دقيقة تأخير</label>
              <input
                className="form-input"
                name="late_deduction_per_minute"
                type="number"
                min="0"
                step="0.01"
                defaultValue={settings.late_deduction_per_minute}
                required
              />
              <span className="form-hint">يُخصم من الراتب الشهري عند التأخير</span>
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: "320px" }}>
            <label className="form-label">أيام العمل الشهرية</label>
            <input
              className="form-input"
              name="workdays_per_month"
              type="number"
              min="0"
              step="1"
              defaultValue={settings.workdays_per_month}
              required
            />
            <span className="form-hint">للعرض والمرجعية فقط</span>
          </div>

          <button className="btn btn-primary btn-lg" type="submit" style={{ marginTop: "8px", width: "fit-content" }}>
            💾 حفظ الإعدادات
          </button>
        </form>
      </section>
    </div>
  );
}
