"use server";

import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { revalidatePath } from "next/cache";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length ? value : null;
}

function money(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export async function createEmployee(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) return;

  const employeeType = text(formData, "employee_type") || "center";
  const hireDate = nullableText(formData, "hire_date");

  const db = getDb();

  // Auto-generate employee code using the database function
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
      allowance
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
      ${money(formData, "allowance")}
    )
  `;
  revalidatePath("/admin/employees");
  revalidatePath("/admin/salaries");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function updateEmployee(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!id || !name) return;

  const active = formData.get("active") === "on";
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
        active = ${active}
    WHERE id = ${id}
  `;
  revalidatePath("/admin/employees");
  revalidatePath(`/admin/employees/${id}`);
  revalidatePath("/admin/salaries");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
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
  const status = text(formData, "status") || "present";

  if (!employeeId || !localDate) return;

  const db = getDb();

  // Get late deduction settings
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

  await db`
    INSERT INTO attendance_records (
      employee_id,
      scanned_at,
      local_date,
      local_time,
      status,
      late_minutes,
      deduction,
      source
    )
    VALUES (
      ${employeeId},
      now(),
      ${localDate}::date,
      ${localTime || "09:00"}::time,
      ${status},
      ${lateMinutes},
      ${deduction},
      'manual'
    )
    ON CONFLICT (employee_id, local_date) DO UPDATE SET
      scanned_at = now(),
      local_time = ${localTime || "09:00"}::time,
      status = ${status},
      late_minutes = ${lateMinutes},
      deduction = ${deduction},
      source = 'manual'
  `;
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/salaries");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}

export async function deleteAttendanceRecord(formData: FormData) {
  await requireAdmin();
  const recordId = text(formData, "record_id");
  if (!recordId) return;

  const db = getDb();
  await db`DELETE FROM attendance_records WHERE id = ${recordId}`;
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/salaries");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
}
