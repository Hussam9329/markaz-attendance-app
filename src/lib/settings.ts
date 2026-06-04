import { getDb } from "@/lib/db";

export type AppSettings = {
  center_name: string;
  timezone: string;
  currency: string;
  late_after_time: string;
  late_deduction_per_minute: string;
  workdays_per_month: string;
};

export const DEFAULT_SETTINGS: AppSettings = {
  center_name: "مركز أستاذ حسن فلاح",
  timezone: "Asia/Baghdad",
  currency: "IQD",
  late_after_time: "09:00:00",
  late_deduction_per_minute: "0",
  workdays_per_month: "26"
};

export async function getSettings(): Promise<AppSettings> {
  const db = getDb();
  const rows = await db`SELECT key, value FROM app_settings`;
  const settings = { ...DEFAULT_SETTINGS };

  for (const row of rows as { key: keyof AppSettings; value: string }[]) {
    if (row.key in settings) settings[row.key] = row.value;
  }

  return settings;
}

export async function upsertSetting(key: keyof AppSettings, value: string) {
  const db = getDb();
  await db`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
