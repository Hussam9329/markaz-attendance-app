import Scanner from "@/components/Scanner";
import { DEFAULT_SETTINGS, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  let centerName = DEFAULT_SETTINGS.center_name;

  try {
    const settings = await getSettings();
    centerName = settings.center_name;
  } catch {
    // Keep scanner renderable even before DATABASE_URL/schema are configured.
  }

  return <Scanner centerName={centerName} />;
}
