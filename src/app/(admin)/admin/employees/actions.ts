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

function generatedEmployeeCode() {
  return `EMP-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export async function createEmployee(formData: FormData) {
  await requireAdmin();
  const name = text(formData, "name");
  if (!name) return;

  const employeeCode = text(formData, "employee_code") || generatedEmployeeCode();
  const hireDate = nullableText(formData, "hire_date");

  const db = getDb();
  await db`
    INSERT INTO employees (
      employee_code,
      name,
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
  const hireDate = nullableText(formData, "hire_date");
  const db = getDb();
  await db`
    UPDATE employees
    SET employee_code = ${employeeCode},
        name = ${name},
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
