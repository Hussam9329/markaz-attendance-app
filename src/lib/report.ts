import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { currentMonth, monthBounds } from "@/lib/time";

export type MonthlySalaryRow = {
  employee_id: string;
  employee_code: string;
  name: string;
  department: string;
  job_title: string;
  phone: string;
  monthly_salary: number;
  allowance: number;
  gross_salary: number;
  expected_workdays: number;
  attendance_days: number;
  absent_days: number;
  late_days: number;
  total_late_minutes: number;
  late_deductions: number;
  absence_deductions: number;
  total_deductions: number;
  net_salary: number;
};

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function expectedWorkdaysForMonth(month: string, workdaysSetting: string, timeZone: string) {
  const configuredWorkdays = Math.max(0, Math.floor(Number(workdaysSetting || 0)) || 0);
  const liveMonth = currentMonth(timeZone);

  if (month === liveMonth) {
    const todayDay = Number(new Intl.DateTimeFormat("en-CA", { timeZone, day: "2-digit" }).format(new Date()));
    return Math.min(configuredWorkdays, todayDay || configuredWorkdays);
  }

  return configuredWorkdays;
}

export async function getMonthlySalaryReport(month: string): Promise<MonthlySalaryRow[]> {
  const db = getDb();
  const settings = await getSettings();
  const { start, end } = monthBounds(month);
  const expectedWorkdays = expectedWorkdaysForMonth(month, settings.workdays_per_month, settings.timezone);

  const rows = await db`
    WITH attendance AS (
      SELECT
        employee_id,
        COUNT(id)::int AS attendance_days,
        COALESCE(SUM(CASE WHEN late_minutes > 0 THEN 1 ELSE 0 END), 0)::int AS late_days,
        COALESCE(SUM(late_minutes), 0)::int AS total_late_minutes,
        COALESCE(SUM(deduction), 0) AS late_deductions
      FROM attendance_records
      WHERE local_date >= ${start}::date
        AND local_date < ${end}::date
      GROUP BY employee_id
    )
    SELECT
      e.id AS employee_id,
      COALESCE(e.employee_code, '') AS employee_code,
      e.name,
      COALESCE(e.department, '') AS department,
      COALESCE(e.job_title, '') AS job_title,
      COALESCE(e.phone, '') AS phone,
      e.monthly_salary,
      COALESCE(e.allowance, 0) AS allowance,
      (${expectedWorkdays})::int AS expected_workdays,
      COALESCE(a.attendance_days, 0)::int AS attendance_days,
      GREATEST((${expectedWorkdays})::int - COALESCE(a.attendance_days, 0), 0)::int AS absent_days,
      COALESCE(a.late_days, 0)::int AS late_days,
      COALESCE(a.total_late_minutes, 0)::int AS total_late_minutes,
      COALESCE(a.late_deductions, 0) AS late_deductions,
      CASE
        WHEN (${expectedWorkdays})::numeric > 0 THEN
          (e.monthly_salary / (${expectedWorkdays})::numeric) * GREATEST((${expectedWorkdays})::int - COALESCE(a.attendance_days, 0), 0)
        ELSE 0
      END AS absence_deductions,
      (e.monthly_salary + COALESCE(e.allowance, 0)) AS gross_salary,
      (
        COALESCE(a.late_deductions, 0) +
        CASE
          WHEN (${expectedWorkdays})::numeric > 0 THEN
            (e.monthly_salary / (${expectedWorkdays})::numeric) * GREATEST((${expectedWorkdays})::int - COALESCE(a.attendance_days, 0), 0)
          ELSE 0
        END
      ) AS total_deductions,
      GREATEST(
        (e.monthly_salary + COALESCE(e.allowance, 0)) -
        (
          COALESCE(a.late_deductions, 0) +
          CASE
            WHEN (${expectedWorkdays})::numeric > 0 THEN
              (e.monthly_salary / (${expectedWorkdays})::numeric) * GREATEST((${expectedWorkdays})::int - COALESCE(a.attendance_days, 0), 0)
            ELSE 0
          END
        ),
        0
      ) AS net_salary
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.id
    WHERE e.active = true
    ORDER BY e.department ASC NULLS LAST, e.name ASC
  `;

  return (rows as Record<string, unknown>[]).map((row) => ({
    employee_id: String(row.employee_id),
    employee_code: String(row.employee_code ?? ""),
    name: String(row.name),
    department: String(row.department ?? ""),
    job_title: String(row.job_title ?? ""),
    phone: String(row.phone ?? ""),
    monthly_salary: toNumber(row.monthly_salary),
    allowance: toNumber(row.allowance),
    gross_salary: toNumber(row.gross_salary),
    expected_workdays: toNumber(row.expected_workdays),
    attendance_days: toNumber(row.attendance_days),
    absent_days: toNumber(row.absent_days),
    late_days: toNumber(row.late_days),
    total_late_minutes: toNumber(row.total_late_minutes),
    late_deductions: toNumber(row.late_deductions),
    absence_deductions: toNumber(row.absence_deductions),
    total_deductions: toNumber(row.total_deductions),
    net_salary: toNumber(row.net_salary)
  }));
}
