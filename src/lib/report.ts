import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { monthBounds } from "@/lib/time";

export type PayrollAdjustmentType =
  | "addition"
  | "task"
  | "bonus"
  | "deduction"
  | "advance"
  | "late_deduction"
  | "absence_deduction";

export type PayrollAdjustment = {
  id: string;
  employee_id: string;
  month: string;
  type: PayrollAdjustmentType;
  amount: number;
  note: string;
  affects_bonus: boolean;
  created_at: string;
};

export type MonthlySalaryRow = {
  employee_id: string;
  employee_code: string;
  name: string;
  employee_type: string;
  department: string;
  job_title: string;
  phone: string;
  monthly_salary: number;
  allowance: number;
  salary_base_calculated: number;
  gross_salary: number;
  required_workdays: number;
  expected_workdays: number;
  attendance_days: number;
  extra_days: number;
  overtime_day_rate: number;
  overtime_amount: number;
  absent_days: number;
  absent_excused_days: number;
  absent_unexcused_days: number;
  absent_before_required_days: number;
  absent_after_required_days: number;
  late_days: number;
  total_late_minutes: number;
  late_deductions: number;
  absence_deductions: number;
  manual_deductions: number;
  manual_additions: number;
  task_amount: number;
  automatic_bonus: number;
  bonus_amount: number;
  bonus_eligible: boolean;
  bonus_blocked: boolean;
  total_deductions: number;
  net_salary: number;
  day_value: number;
  daily_salary_mode: boolean;
  overtime_enabled: boolean;
  bonus_enabled: boolean;
};

type EmployeePayrollRow = {
  id: string;
  employee_code: string;
  name: string;
  employee_type: string;
  department: string;
  job_title: string;
  phone: string;
  monthly_salary: unknown;
  allowance: unknown;
  required_workdays: unknown;
  overtime_day_rate: unknown;
  bonus_amount: unknown;
  daily_salary_mode: boolean;
  overtime_enabled: boolean;
  bonus_enabled: boolean;
};

type AttendancePayrollEvent = {
  employee_id: string;
  local_date: string;
  local_time: string;
  status: "present" | "late" | "absent";
  late_minutes: unknown;
  deduction: unknown;
  absence_type: "excused" | "unexcused" | null;
};

type AdjustmentRow = {
  id: string;
  employee_id: string;
  month: string;
  type: PayrollAdjustmentType;
  amount: unknown;
  note: string;
  affects_bonus: boolean;
  created_at: string;
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function positiveInt(value: unknown, fallback = 0) {
  const n = Math.floor(toNumber(value));
  return n > 0 ? n : fallback;
}

function moneyRound(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function defaultRequiredDays(jobTitle: string, employeeType: string, configured: number) {
  const normalized = `${jobTitle} ${employeeType}`.toLowerCase();
  if (normalized.includes("مصحح") || normalized.includes("تصحيح") || normalized.includes("checker")) return 16;
  return configured > 0 ? configured : 30;
}

function mapAdjustment(row: AdjustmentRow): PayrollAdjustment {
  return {
    id: String(row.id),
    employee_id: String(row.employee_id),
    month: String(row.month),
    type: row.type,
    amount: toNumber(row.amount),
    note: String(row.note ?? ""),
    affects_bonus: Boolean(row.affects_bonus),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getPayrollAdjustments(month: string, employeeId?: string): Promise<PayrollAdjustment[]> {
  const db = getDb();
  const rows = employeeId
    ? await db`
        SELECT id, employee_id, month, type, amount, COALESCE(note, '') AS note, affects_bonus, created_at::text
        FROM payroll_adjustments
        WHERE month = ${month} AND employee_id = ${employeeId}
        ORDER BY created_at DESC
      `
    : await db`
        SELECT id, employee_id, month, type, amount, COALESCE(note, '') AS note, affects_bonus, created_at::text
        FROM payroll_adjustments
        WHERE month = ${month}
        ORDER BY created_at DESC
      `;

  return (rows as AdjustmentRow[]).map(mapAdjustment);
}

export async function getMonthlySalaryReport(month: string): Promise<MonthlySalaryRow[]> {
  const db = getDb();
  const settings = await getSettings();
  const { start, end } = monthBounds(month);
  const configuredWorkdays = positiveInt(settings.workdays_per_month, 30);
  const unexcusedPenalty = toNumber(settings.unexcused_absence_penalty || 10);
  const afterRequiredPenalty = toNumber(settings.after_required_unexcused_absence_penalty || 10);

  const employees = (await db`
    SELECT
      id,
      COALESCE(employee_code, '') AS employee_code,
      name,
      COALESCE(employee_type, 'center') AS employee_type,
      COALESCE(department, '') AS department,
      COALESCE(job_title, '') AS job_title,
      COALESCE(phone, '') AS phone,
      COALESCE(monthly_salary, 0) AS monthly_salary,
      COALESCE(allowance, 0) AS allowance,
      COALESCE(required_workdays, 0) AS required_workdays,
      COALESCE(overtime_day_rate, 0) AS overtime_day_rate,
      COALESCE(bonus_amount, 0) AS bonus_amount,
      COALESCE(daily_salary_mode, false) AS daily_salary_mode,
      COALESCE(overtime_enabled, true) AS overtime_enabled,
      COALESCE(bonus_enabled, false) AS bonus_enabled
    FROM employees
    WHERE active = true
    ORDER BY employee_type ASC, department ASC NULLS LAST, name ASC
  `) as EmployeePayrollRow[];

  const attendanceRows = (await db`
    SELECT
      employee_id,
      local_date::text,
      local_time::text,
      status,
      COALESCE(late_minutes, 0) AS late_minutes,
      COALESCE(deduction, 0) AS deduction,
      absence_type
    FROM attendance_records
    WHERE local_date >= ${start}::date
      AND local_date < ${end}::date
    ORDER BY local_date ASC, local_time ASC
  `) as AttendancePayrollEvent[];

  const adjustmentRows = (await db`
    SELECT id, employee_id, month, type, amount, COALESCE(note, '') AS note, affects_bonus, created_at::text
    FROM payroll_adjustments
    WHERE month = ${month}
  `) as AdjustmentRow[];

  const eventsByEmployee = new Map<string, AttendancePayrollEvent[]>();
  for (const event of attendanceRows) {
    const employeeId = String(event.employee_id);
    const list = eventsByEmployee.get(employeeId) ?? [];
    list.push(event);
    eventsByEmployee.set(employeeId, list);
  }

  const adjustmentsByEmployee = new Map<string, PayrollAdjustment[]>();
  for (const row of adjustmentRows.map(mapAdjustment)) {
    const list = adjustmentsByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    adjustmentsByEmployee.set(row.employee_id, list);
  }

  return employees.map((employee) => {
    const employeeId = String(employee.id);
    const monthlySalary = toNumber(employee.monthly_salary);
    const allowance = toNumber(employee.allowance);
    const requiredWorkdays = positiveInt(
      employee.required_workdays,
      defaultRequiredDays(String(employee.job_title ?? ""), String(employee.employee_type ?? "center"), configuredWorkdays)
    );
    const dayValue = requiredWorkdays > 0 ? monthlySalary / requiredWorkdays : 0;
    const overtimeDayRate = toNumber(employee.overtime_day_rate) || dayValue;
    const events = eventsByEmployee.get(employeeId) ?? [];
    const adjustments = adjustmentsByEmployee.get(employeeId) ?? [];

    let attendedSoFar = 0;
    let attendanceDays = 0;
    let lateDays = 0;
    let totalLateMinutes = 0;
    let lateDeductions = 0;
    let absentExcusedDays = 0;
    let absentUnexcusedDays = 0;
    let absentBeforeRequiredDays = 0;
    let absentAfterRequiredDays = 0;
    let absenceDeductions = 0;

    for (const event of events) {
      if (event.status === "present" || event.status === "late") {
        attendedSoFar += 1;
        attendanceDays += 1;
        if (event.status === "late" || toNumber(event.late_minutes) > 0) {
          lateDays += 1;
          totalLateMinutes += toNumber(event.late_minutes);
          lateDeductions += toNumber(event.deduction);
        }
        continue;
      }

      const isAfterRequired = attendedSoFar >= requiredWorkdays;
      const absenceType = event.absence_type === "excused" ? "excused" : "unexcused";

      if (absenceType === "excused") absentExcusedDays += 1;
      else absentUnexcusedDays += 1;

      if (isAfterRequired) absentAfterRequiredDays += 1;
      else absentBeforeRequiredDays += 1;

      if (employee.daily_salary_mode) {
        if (absenceType === "unexcused") {
          absenceDeductions += isAfterRequired ? afterRequiredPenalty : unexcusedPenalty;
        }
      } else if (isAfterRequired) {
        absenceDeductions += absenceType === "unexcused" ? afterRequiredPenalty : 0;
      } else {
        absenceDeductions += absenceType === "unexcused" ? dayValue + unexcusedPenalty : dayValue;
      }
    }

    const extraDays = employee.overtime_enabled ? Math.max(0, attendanceDays - requiredWorkdays) : 0;
    const overtimeAmount = extraDays * overtimeDayRate;
    const salaryBaseCalculated = employee.daily_salary_mode
      ? Math.min(attendanceDays, requiredWorkdays) * dayValue
      : monthlySalary;

    let manualDeductions = 0;
    let manualAdditions = 0;
    let taskAmount = 0;
    let blockingDeductions = 0;

    for (const adjustment of adjustments) {
      if (["deduction", "advance", "late_deduction", "absence_deduction"].includes(adjustment.type)) {
        manualDeductions += adjustment.amount;
        if (adjustment.affects_bonus) blockingDeductions += adjustment.amount;
      } else {
        manualAdditions += adjustment.amount;
        if (adjustment.type === "task") taskAmount += adjustment.amount;
      }
    }

    const absentDays = absentExcusedDays + absentUnexcusedDays;
    const bonusAmount = toNumber(employee.bonus_amount);
    const bonusBlocked = absentDays > 0 || lateDays > 0 || totalLateMinutes > 0 || lateDeductions > 0 || blockingDeductions > 0;
    const bonusEligible = Boolean(employee.bonus_enabled) && !bonusBlocked;
    const automaticBonus = bonusEligible ? bonusAmount : 0;

    const grossSalary = salaryBaseCalculated + allowance + overtimeAmount + manualAdditions + automaticBonus;
    const totalDeductions = absenceDeductions + lateDeductions + manualDeductions;
    const netSalary = Math.max(grossSalary - totalDeductions, 0);

    return {
      employee_id: employeeId,
      employee_code: String(employee.employee_code ?? ""),
      name: String(employee.name ?? ""),
      employee_type: String(employee.employee_type ?? "center"),
      department: String(employee.department ?? ""),
      job_title: String(employee.job_title ?? ""),
      phone: String(employee.phone ?? ""),
      monthly_salary: moneyRound(monthlySalary),
      allowance: moneyRound(allowance),
      salary_base_calculated: moneyRound(salaryBaseCalculated),
      gross_salary: moneyRound(grossSalary),
      required_workdays: requiredWorkdays,
      expected_workdays: requiredWorkdays,
      attendance_days: attendanceDays,
      extra_days: extraDays,
      overtime_day_rate: moneyRound(overtimeDayRate),
      overtime_amount: moneyRound(overtimeAmount),
      absent_days: absentDays,
      absent_excused_days: absentExcusedDays,
      absent_unexcused_days: absentUnexcusedDays,
      absent_before_required_days: absentBeforeRequiredDays,
      absent_after_required_days: absentAfterRequiredDays,
      late_days: lateDays,
      total_late_minutes: totalLateMinutes,
      late_deductions: moneyRound(lateDeductions),
      absence_deductions: moneyRound(absenceDeductions),
      manual_deductions: moneyRound(manualDeductions),
      manual_additions: moneyRound(manualAdditions),
      task_amount: moneyRound(taskAmount),
      automatic_bonus: moneyRound(automaticBonus),
      bonus_amount: moneyRound(bonusAmount),
      bonus_eligible: bonusEligible,
      bonus_blocked: bonusBlocked,
      total_deductions: moneyRound(totalDeductions),
      net_salary: moneyRound(netSalary),
      day_value: moneyRound(dayValue),
      daily_salary_mode: Boolean(employee.daily_salary_mode),
      overtime_enabled: Boolean(employee.overtime_enabled),
      bonus_enabled: Boolean(employee.bonus_enabled),
    };
  });
}
