"use client";

const PRESETS = {
  full_time: {
    label: "إداري / دوام كامل",
    hint: "30 يوم، بلا إضافي افتراضي، مناسب للموظفين الثابتين.",
    requiredWorkdays: "30",
    overtimeDayRate: "0",
    bonusAmount: "0",
    overtimeEnabled: false,
    bonusEnabled: false,
    dailySalaryMode: false,
  },
  checker: {
    label: "مصحح",
    hint: "16 يوم، اليوم الإضافي 25، ويمكن تفعيل مكافأة المصحح.",
    requiredWorkdays: "16",
    overtimeDayRate: "25",
    bonusAmount: "25",
    overtimeEnabled: true,
    bonusEnabled: true,
    dailySalaryMode: false,
  },
  trainer: {
    label: "مدرب / أجور أعلى",
    hint: "16 يوم، اليوم الإضافي 35، والمكافأة حسب قرار الإدارة.",
    requiredWorkdays: "16",
    overtimeDayRate: "35",
    bonusAmount: "0",
    overtimeEnabled: true,
    bonusEnabled: false,
    dailySalaryMode: false,
  },
  daily: {
    label: "يومي / بدأ من نص الشهر",
    hint: "30 يوم افتراضي، يحتسب الراتب حسب أيام الحضور فقط.",
    requiredWorkdays: "30",
    overtimeDayRate: "0",
    bonusAmount: "0",
    overtimeEnabled: false,
    bonusEnabled: false,
    dailySalaryMode: true,
  },
} as const;

type PresetKey = keyof typeof PRESETS;

function setInput(form: HTMLFormElement, name: string, value: string) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function setCheckbox(form: HTMLFormElement, name: string, checked: boolean) {
  const input = form.elements.namedItem(name);
  if (input instanceof HTMLInputElement && input.type === "checkbox") {
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function PayrollPresetSelect({ defaultPreset = "full_time" }: { defaultPreset?: PresetKey | "custom" }) {
  return (
    <div className="form-group full-span payroll-template-box">
      <label className="form-label">قالب الراتب الجاهز</label>
      <select
        className="form-input"
        name="payroll_template"
        defaultValue={defaultPreset}
        onChange={(event) => {
          const value = event.currentTarget.value as PresetKey | "custom";
          if (value === "custom") return;
          const preset = PRESETS[value];
          const form = event.currentTarget.closest("form");
          if (!(form instanceof HTMLFormElement)) return;

          setInput(form, "required_workdays", preset.requiredWorkdays);
          setInput(form, "overtime_day_rate", preset.overtimeDayRate);
          setInput(form, "bonus_amount", preset.bonusAmount);
          setCheckbox(form, "overtime_enabled", preset.overtimeEnabled);
          setCheckbox(form, "bonus_enabled", preset.bonusEnabled);
          setCheckbox(form, "daily_salary_mode", preset.dailySalaryMode);
        }}
      >
        <option value="full_time">إداري / دوام كامل — 30 يوم</option>
        <option value="checker">مصحح — 16 يوم + إضافي 25</option>
        <option value="trainer">مدرب — 16 يوم + إضافي 35</option>
        <option value="daily">يومي / بدأ من نص الشهر</option>
        <option value="custom">مخصص — لا تغيّر القيم الحالية</option>
      </select>
      <span className="form-help">اختَر قالباً ليملأ الأيام المطلوبة، اليوم الإضافي، المكافأة، وخيارات الاحتساب تلقائياً، ثم عدّل الأرقام إذا احتجت.</span>
      <div className="preset-hints" aria-hidden="true">
        {Object.values(PRESETS).map((preset) => (
          <span key={preset.label}>{preset.label}: {preset.hint}</span>
        ))}
      </div>
    </div>
  );
}
