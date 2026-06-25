"use server";

import { requireAdmin } from "@/lib/auth";
import { DEFAULT_SETTINGS, type AppSettings, upsertSetting } from "@/lib/settings";
import { revalidatePath } from "next/cache";

function text(formData: FormData, key: keyof AppSettings) {
  return String(formData.get(key) ?? DEFAULT_SETTINGS[key]).trim();
}

function positiveNumberText(formData: FormData, key: keyof AppSettings) {
  const value = Number(text(formData, key));
  return String(Number.isFinite(value) && value >= 0 ? value : 0);
}

export async function updateSettings(formData: FormData) {
  await requireAdmin();

  await upsertSetting("center_name", text(formData, "center_name") || DEFAULT_SETTINGS.center_name);
  await upsertSetting("timezone", text(formData, "timezone") || DEFAULT_SETTINGS.timezone);
  await upsertSetting("currency", text(formData, "currency") || DEFAULT_SETTINGS.currency);
  await upsertSetting("late_after_time", text(formData, "late_after_time") || DEFAULT_SETTINGS.late_after_time);
  await upsertSetting("late_deduction_per_minute", positiveNumberText(formData, "late_deduction_per_minute"));
  await upsertSetting("workdays_per_month", positiveNumberText(formData, "workdays_per_month"));
  await upsertSetting("unexcused_absence_penalty", positiveNumberText(formData, "unexcused_absence_penalty"));
  await upsertSetting("after_required_unexcused_absence_penalty", positiveNumberText(formData, "after_required_unexcused_absence_penalty"));

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
