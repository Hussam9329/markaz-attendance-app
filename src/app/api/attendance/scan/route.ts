import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { calculateLateMinutes, getLocalParts } from "@/lib/time";

export const runtime = "nodejs";

type EmployeeRow = {
  id: string;
  name: string;
  active: boolean;
  employee_type: string;
};

type AttendanceRow = {
  scanned_at: string;
  local_date: string;
  local_time: string;
  status: "present" | "late";
  late_minutes: number | string;
  deduction: number | string;
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = String(body.token ?? "").trim();

    if (!token) {
      return json({ ok: false, message: "QR غير صالح." }, 400);
    }

    const db = getDb();
    const employeeRows = await db`
      SELECT id, name, active, COALESCE(employee_type, 'center') AS employee_type
      FROM employees
      WHERE qr_token = ${token}
      LIMIT 1
    `;

    const employee = (employeeRows as EmployeeRow[])[0];
    if (!employee || !employee.active) {
      return json({ ok: false, message: "الموظف غير موجود أو غير مفعّل." }, 404);
    }

    // Crew employees cannot use QR scanning - they must have attendance entered manually
    if (employee.employee_type === "crew") {
      return json({ ok: false, message: "هذا الموظف من الطاقم. يتم إدخال حضوره يدوياً من لوحة الإدارة." }, 400);
    }

    const settings = await getSettings();
    const now = new Date();
    const local = getLocalParts(now, settings.timezone);
    const lateMinutes = calculateLateMinutes(local.time, settings.late_after_time);
    const deduction = lateMinutes * Number(settings.late_deduction_per_minute || 0);
    const status = lateMinutes > 0 ? "late" : "present";

    const inserted = await db`
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
        ${employee.id},
        ${now.toISOString()},
        ${local.date}::date,
        ${local.time}::time,
        ${status},
        ${lateMinutes},
        ${deduction},
        'qr'
      )
      ON CONFLICT (employee_id, local_date) DO NOTHING
      RETURNING scanned_at, local_date::text, local_time::text, status, late_minutes, deduction
    `;

    let duplicate = false;
    let record = (inserted as AttendanceRow[])[0];

    if (!record) {
      duplicate = true;
      const existing = await db`
        SELECT scanned_at, local_date::text, local_time::text, status, late_minutes, deduction
        FROM attendance_records
        WHERE employee_id = ${employee.id}
          AND local_date = ${local.date}::date
        LIMIT 1
      `;
      record = (existing as AttendanceRow[])[0];
    }

    return json({
      ok: true,
      duplicate,
      message: duplicate ? "هذا الموظف مسجل حضوره مسبقاً اليوم." : "تم تسجيل الحضور بنجاح.",
      employee: { name: employee.name },
      record: {
        scannedAt: record.scanned_at,
        localDate: record.local_date,
        localTime: record.local_time,
        status: record.status,
        lateMinutes: Number(record.late_minutes),
        deduction: Number(record.deduction)
      }
    });
  } catch (error) {
    console.error(error);
    return json({ ok: false, message: "حدث خطأ في الخادم." }, 500);
  }
}
