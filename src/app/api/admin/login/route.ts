import { ADMIN_COOKIE, adminCookieOptions, createAdminSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || password !== adminPassword) {
    redirect("/admin/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, createAdminSession(), adminCookieOptions());
  redirect("/admin");
}
