"use server";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toEnglishDigits } from "@/lib/format";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function money(formData: FormData, key: string) {
  const value = Number(toEnglishDigits(text(formData, key)));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function positiveInt(formData: FormData, key: string) {
  const value = Math.floor(Number(toEnglishDigits(text(formData, key))));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function revalidatePayroll(id?: string) {
  revalidatePath("/admin/employees");
  if (id) revalidatePath(`/admin/employees/${id}`);
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/salaries");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function createEmployee(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) return;

  const employeeType = text(formData, "employee_type") || "center";
  const hireDate = nullableText(formData, "hire_date");

  const db = getDb();
  const codeRows = await db`SELECT next_employee_code() AS code`;
  const employeeCode = (codeRows as { code: string }[])[0]?.code;

  await db`
    INSERT INTO employees (
      employee_code,
      name,
      employee_type,
      department,
      job_title,
      phone,
      hire_date,
      bank_account,
      monthly_salary,
      allowance,
      required_workdays,
      overtime_day_rate,
      bonus_amount,
      daily_salary_mode,
      overtime_enabled,
      bonus_enabled
    )
    VALUES (
      ${employeeCode},
      ${name},
      ${employeeType},
      ${text(formData, "department")},
      ${text(formData, "job_title")},
      ${text(formData, "phone")},
      ${hireDate},
      ${text(formData, "bank_account")},
      ${money(formData, "monthly_salary")},
      ${money(formData, "allowance")},
      ${positiveInt(formData, "required_workdays")},
      ${money(formData, "overtime_day_rate")},
      ${money(formData, "bonus_amount")},
      ${checkbox(formData, "daily_salary_mode")},
      ${formData.get("overtime_enabled") !== null},
      ${checkbox(formData, "bonus_enabled")}
    )
  `;
  revalidatePayroll();
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id || !name) return;

  const active = checkbox(formData, "active");
  const employeeCode = nullableText(formData, "employee_code");
  const employeeType = text(formData, "employee_type") || "center";
  const hireDate = nullableText(formData, "hire_date");
  const db = getDb();
  await db`
    UPDATE employees
    SET employee_code = ${employeeCode},
        name = ${name},
        employee_type = ${employeeType},
        department = ${text(formData, "department")},
        job_title = ${text(formData, "job_title")},
        phone = ${text(formData, "phone")},
        hire_date = ${hireDate},
        bank_account = ${text(formData, "bank_account")},
        monthly_salary = ${money(formData, "monthly_salary")},
        allowance = ${money(formData, "allowance")},
        required_workdays = ${positiveInt(formData, "required_workdays")},
        overtime_day_rate = ${money(formData, "overtime_day_rate")},
        bonus_amount = ${money(formData, "bonus_amount")},
        daily_salary_mode = ${checkbox(formData, "daily_salary_mode")},
        overtime_enabled = ${formData.get("overtime_enabled") !== null},
        bonus_enabled = ${checkbox(formData, "bonus_enabled")},
        active = ${active}
    WHERE id = ${id}
  `;
  revalidatePayroll(id);
}

export async function regenerateQr(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) return;

  const db = getDb();
  await db`
    UPDATE employees
    SET qr_token = encode(gen_random_bytes(24), 'hex')
    WHERE id = ${id}
  `;
  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${id}`);
}

export async function addManualAttendance(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employee_id");
  const localDate = text(formData, "local_date");
  const localTime = text(formData, "local_time");
  const rawStatus = text(formData, "status") || "present";
  const status = ["present", "late", "absent"].includes(rawStatus) ? rawStatus : "present";
  const absenceType = status === "absent" ? (text(formData, "absence_type") === "excused" ? "excused" : "unexcused") : null;
  const note = text(formData, "note");

  if (!employeeId || !localDate) return;

  const db = getDb();

  const settingsRows = await db`
    SELECT key, value FROM app_settings
    WHERE key IN ('late_after_time', 'late_deduction_per_minute')
  `;
  const settingsMap = Object.fromEntries(
    (settingsRows as { key: string; value: string }[]).map((r) => [r.key, r.value])
  );

  let lateMinutes = 0;
  let deduction = 0;
  if (status === "late" && localTime) {
    const lateAfter = settingsMap.late_after_time || "09:00:00";
    const [lateH, lateM] = lateAfter.split(":").map(Number);
    const [timeH, timeM] = localTime.split(":").map(Number);
    lateMinutes = Math.max(0, (timeH * 60 + timeM) - (lateH * 60 + lateM));
    deduction = lateMinutes * Number(settingsMap.late_deduction_per_minute || 0);
  }

  const effectiveTime = status === "absent" ? "00:00" : localTime || "09:00";

  await db`
    INSERT INTO attendance_records (
      employee_id,
      scanned_at,
      local_date,
      local_time,
      status,
      absence_type,
      note,
      late_minutes,
      deduction,
      source
    )
    VALUES (
      ${employeeId},
      now(),
      ${localDate}::date,
      ${effectiveTime}::time,
      ${status},
      ${absenceType},
      ${note},
      ${lateMinutes},
      ${deduction},
      'manual'
    )
    ON CONFLICT (employee_id, local_date) DO UPDATE SET
      scanned_at = now(),
      local_time = ${effectiveTime}::time,
      status = ${status},
      absence_type = ${absenceType},
      note = ${note},
      late_minutes = ${lateMinutes},
      deduction = ${deduction},
      source = 'manual'
  `;
  revalidatePayroll(employeeId);
}

export async function deleteAttendanceRecord(formData: FormData) {
  await requireAdmin();
  const recordId = text(formData, "record_id");
  if (!recordId) return;

  const db = getDb();
  await db`DELETE FROM attendance_records WHERE id = ${recordId}`;
  revalidatePayroll();
}

export async function addPayrollAdjustment(formData: FormData) {
  await requireAdmin();
  const employeeId = text(formData, "employee_id");
  const month = text(formData, "month");
  const type = text(formData, "type") || "deduction";
  const amount = money(formData, "amount");
  const note = text(formData, "note");
  const affectsBonus = checkbox(formData, "affects_bonus");

  if (!employeeId || !/^\d{4}-\d{2}$/.test(month) || amount <= 0 || !note) return;

  const allowed = ["addition", "task", "bonus", "deduction", "advance", "late_deduction", "absence_deduction"];
  if (!allowed.includes(type)) return;

  const db = getDb();
  await db`
    INSERT INTO payroll_adjustments (employee_id, month, type, amount, note, affects_bonus)
    VALUES (${employeeId}, ${month}, ${type}, ${amount}, ${note}, ${affectsBonus})
  `;
  revalidatePayroll(employeeId);
}

export async function deletePayrollAdjustment(formData: FormData) {
  await requireAdmin();
  const adjustmentId = text(formData, "adjustment_id");
  const employeeId = text(formData, "employee_id");
  if (!adjustmentId) return;

  const db = getDb();
  await db`DELETE FROM payroll_adjustments WHERE id = ${adjustmentId}`;
  revalidatePayroll(employeeId || undefined);
}
