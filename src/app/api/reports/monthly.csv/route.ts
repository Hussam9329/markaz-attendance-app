import { requireAdmin } from "@/lib/auth";
import { getMonthlySalaryReport } from "@/lib/report";
import { getSettings } from "@/lib/settings";
import { currentMonth } from "@/lib/time";

export const runtime = "nodejs";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  await requireAdmin();
  const settings = await getSettings();
  const url = new URL(request.url);
  const month = url.searchParams.get("month") || currentMonth(settings.timezone);
  const rows = await getMonthlySalaryReport(month);

  const header = [
    "الشهر",
    "كود الموظف",
    "الموظف",
    "نوع الموظف",
    "القسم",
    "الوظيفة",
    "الهاتف",
    "الراتب الأساسي",
    "المخصصات",
    "إجمالي المستحق",
    "أيام العمل المتوقعة",
    "أيام الحضور",
    "أيام الغياب",
    "أيام التأخير",
    "دقائق التأخير",
    "خصم التأخير",
    "خصم الغياب",
    "إجمالي الخصومات",
    "صافي الراتب",
    "العملة"
  ];

  const lines = [
    header.map(csvCell).join(","),
    ...rows.map((row) =>
      [
        month,
        row.employee_code,
        row.name,
        row.employee_type === "crew" ? "طاقم" : "مركز",
        row.department,
        row.job_title,
        row.phone,
        row.monthly_salary,
        row.allowance,
        row.gross_salary,
        row.expected_workdays,
        row.attendance_days,
        row.absent_days,
        row.late_days,
        row.total_late_minutes,
        row.late_deductions,
        row.absence_deductions,
        row.total_deductions,
        row.net_salary,
        settings.currency
      ].map(csvCell).join(",")
    )
  ];

  return new Response(`\uFEFF${lines.join("\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="markaz-payroll-${month}.csv"`
    }
  });
}
