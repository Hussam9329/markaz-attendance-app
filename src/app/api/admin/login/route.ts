import { ADMIN_COOKIE, adminCookieOptions, createAdminSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const DEFAULT_PASSWORD = "00999900";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;

  if (password !== adminPassword) {
    redirect("/?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions());
  redirect("/admin");
}
