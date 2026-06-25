import { getDb } from "@/lib/db";
import { monthBounds } from "@/lib/time";

export type AttendanceRecord = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  employee_type: string;
  department: string;
  job_title: string;
  local_date: string;
  local_time: string;
  status: "present" | "late" | "absent";
  absence_type: "excused" | "unexcused" | "";
  note: string;
  late_minutes: number;
  deduction: number;
  source: string;
};

export type DaySummary = {
  total_records: number;
  present_count: number;
  late_count: number;
  absent_count: number;
  total_late_minutes: number;
  total_deductions: number;
};

export type AbsentEmployee = {
  id: string;
  employee_code: string;
  name: string;
  employee_type: string;
  department: string;
  job_title: string;
  phone: string;
};

export type CrewEmployee = {
  id: string;
  employee_code: string;
  name: string;
  department: string;
  job_title: string;
};

function toNum(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function toStr(v: unknown) { return String(v ?? ""); }

function mapAttendanceRecord(r: Record<string, unknown>): AttendanceRecord {
  return {
    id: toStr(r.id),
    employee_id: toStr(r.employee_id),
    employee_name: toStr(r.employee_name),
    employee_code: toStr(r.employee_code),
    employee_type: toStr(r.employee_type),
    department: toStr(r.department),
    job_title: toStr(r.job_title),
    local_date: toStr(r.local_date),
    local_time: toStr(r.local_time),
    status: (r.status === "absent" ? "absent" : r.status === "late" ? "late" : "present") as "present" | "late" | "absent",
    absence_type: (r.absence_type === "excused" ? "excused" : r.absence_type === "unexcused" ? "unexcused" : "") as "excused" | "unexcused" | "",
    note: toStr(r.note),
    late_minutes: toNum(r.late_minutes),
    deduction: toNum(r.deduction),
    source: toStr(r.source) || "qr",
  };
}

export async function getAttendanceByDate(date: string): Promise<AttendanceRecord[]> {
  const db = getDb();
  const rows = await db`
    SELECT
      a.id,
      a.employee_id,
      e.name AS employee_name,
      COALESCE(e.employee_code, '') AS employee_code,
      COALESCE(e.employee_type, 'center') AS employee_type,
      COALESCE(e.department, '') AS department,
      COALESCE(e.job_title, '') AS job_title,
      a.local_date::text,
      a.local_time::text,
      a.status,
      a.absence_type,
      COALESCE(a.note, '') AS note,
      a.late_minutes,
      a.deduction,
      COALESCE(a.source, 'qr') AS source
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.local_date = ${date}::date
    ORDER BY a.local_time DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapAttendanceRecord);
}

export async function getAbsentEmployeesByDate(date: string): Promise<AbsentEmployee[]> {
  const db = getDb();
  const rows = await db`
    SELECT
      e.id,
      COALESCE(e.employee_code, '') AS employee_code,
      e.name,
      COALESCE(e.employee_type, 'center') AS employee_type,
      COALESCE(e.department, '') AS department,
      COALESCE(e.job_title, '') AS job_title,
      COALESCE(e.phone, '') AS phone
    FROM employees e
    WHERE e.active = true
      AND NOT EXISTS (
        SELECT 1
        FROM attendance_records a
        WHERE a.employee_id = e.id
          AND a.local_date = ${date}::date
      )
    ORDER BY e.employee_type ASC, e.department ASC NULLS LAST, e.name ASC
  `;

  return (rows as Record<string, unknown>[]).map((r) => ({
    id: toStr(r.id),
    employee_code: toStr(r.employee_code),
    name: toStr(r.name),
    employee_type: toStr(r.employee_type),
    department: toStr(r.department),
    job_title: toStr(r.job_title),
    phone: toStr(r.phone),
  }));
}

export async function getDaySummary(date: string): Promise<DaySummary> {
  const db = getDb();
  const rows = await db`
    SELECT
      COUNT(*)::int AS total_records,
      COUNT(*) FILTER (WHERE status = 'present')::int AS present_count,
      COUNT(*) FILTER (WHERE status = 'late')::int AS late_count,
      COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_count,
      COALESCE(SUM(late_minutes), 0)::int AS total_late_minutes,
      COALESCE(SUM(deduction), 0) AS total_deductions
    FROM attendance_records
    WHERE local_date = ${date}::date
  `;
  const r = (rows as Record<string, unknown>[])[0];
  return {
    total_records: toNum(r.total_records),
    present_count: toNum(r.present_count),
    late_count: toNum(r.late_count),
    absent_count: toNum(r.absent_count),
    total_late_minutes: toNum(r.total_late_minutes),
    total_deductions: toNum(r.total_deductions),
  };
}

export async function getEmployeeAttendance(employeeId: string, month: string): Promise<AttendanceRecord[]> {
  const db = getDb();
  const { start, end } = monthBounds(month);
  const rows = await db`
    SELECT
      a.id,
      a.employee_id,
      e.name AS employee_name,
      COALESCE(e.employee_code, '') AS employee_code,
      COALESCE(e.employee_type, 'center') AS employee_type,
      COALESCE(e.department, '') AS department,
      COALESCE(e.job_title, '') AS job_title,
      a.local_date::text,
      a.local_time::text,
      a.status,
      a.absence_type,
      COALESCE(a.note, '') AS note,
      a.late_minutes,
      a.deduction,
      COALESCE(a.source, 'qr') AS source
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    WHERE a.employee_id = ${employeeId}
      AND a.local_date >= ${start}::date
      AND a.local_date < ${end}::date
    ORDER BY a.local_date DESC, a.local_time DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapAttendanceRecord);
}

export async function getEmployeeMonthSummary(employeeId: string, month: string) {
  const db = getDb();
  const { start, end } = monthBounds(month);
  const rows = await db`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('present', 'late'))::int AS attendance_days,
      COUNT(*) FILTER (WHERE status = 'late')::int AS late_days,
      COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND absence_type = 'excused')::int AS absent_excused_days,
      COUNT(*) FILTER (WHERE status = 'absent' AND COALESCE(absence_type, 'unexcused') = 'unexcused')::int AS absent_unexcused_days,
      COALESCE(SUM(late_minutes), 0)::int AS total_late_minutes,
      COALESCE(SUM(deduction), 0) AS total_deductions
    FROM attendance_records
    WHERE employee_id = ${employeeId}
      AND local_date >= ${start}::date
      AND local_date < ${end}::date
  `;
  const r = (rows as Record<string, unknown>[])[0];
  return {
    attendance_days: toNum(r.attendance_days),
    late_days: toNum(r.late_days),
    absent_days: toNum(r.absent_days),
    absent_excused_days: toNum(r.absent_excused_days),
    absent_unexcused_days: toNum(r.absent_unexcused_days),
    total_late_minutes: toNum(r.total_late_minutes),
    total_deductions: toNum(r.total_deductions),
  };
}

export async function getRecentAttendance(limit = 8): Promise<AttendanceRecord[]> {
  const db = getDb();
  const rows = await db`
    SELECT
      a.id,
      a.employee_id,
      e.name AS employee_name,
      COALESCE(e.employee_code, '') AS employee_code,
      COALESCE(e.employee_type, 'center') AS employee_type,
      COALESCE(e.department, '') AS department,
      COALESCE(e.job_title, '') AS job_title,
      a.local_date::text,
      a.local_time::text,
      a.status,
      a.absence_type,
      COALESCE(a.note, '') AS note,
      a.late_minutes,
      a.deduction,
      COALESCE(a.source, 'qr') AS source
    FROM attendance_records a
    JOIN employees e ON e.id = a.employee_id
    ORDER BY a.scanned_at DESC
    LIMIT ${limit}
  `;
  return (rows as Record<string, unknown>[]).map(mapAttendanceRecord);
}

export async function getCrewEmployees(): Promise<CrewEmployee[]> {
  const db = getDb();
  const rows = await db`
    SELECT
      id,
      COALESCE(employee_code, '') AS employee_code,
      name,
      COALESCE(department, '') AS department,
      COALESCE(job_title, '') AS job_title
    FROM employees
    WHERE active = true AND employee_type = 'crew'
    ORDER BY name ASC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: toStr(r.id),
    employee_code: toStr(r.employee_code),
    name: toStr(r.name),
    department: toStr(r.department),
    job_title: toStr(r.job_title),
  }));
}

export async function getActiveEmployees(): Promise<CrewEmployee[]> {
  const db = getDb();
  const rows = await db`
    SELECT
      id,
      COALESCE(employee_code, '') AS employee_code,
      name,
      COALESCE(department, '') AS department,
      COALESCE(job_title, '') AS job_title
    FROM employees
    WHERE active = true
    ORDER BY name ASC
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: toStr(r.id),
    employee_code: toStr(r.employee_code),
    name: toStr(r.name),
    department: toStr(r.department),
    job_title: toStr(r.job_title),
  }));
}
