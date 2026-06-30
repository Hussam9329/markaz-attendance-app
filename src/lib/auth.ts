import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE = "markaz_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12;

function secret() {
  return process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "dev-only-secret";
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = `admin.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(value?: string) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const signature = parts[2];
  const expiresAt = Number(parts[1]);

  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign(payload));
}

export async function isAdmin() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/");
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  };
}
