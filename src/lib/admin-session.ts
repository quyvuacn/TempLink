import "server-only";
import { cookies } from "next/headers";
import { getServerEnv, isDemoMode } from "@/lib/env";
import { hmac, safeCompare } from "@/lib/security";

const COOKIE_NAME = "templink_admin";
const SESSION_SECONDS = 60 * 60 * 8;

function encodeSession(expiry: number, secret: string) {
  const payload = `admin:${expiry}`;
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${hmac(encoded, secret)}`;
}

function verifySessionValue(value: string | undefined, secret: string) {
  if (!value || !secret) return false;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeCompare(signature, hmac(encoded, secret))) {
    return false;
  }

  try {
    const payload = Buffer.from(encoded, "base64url").toString("utf8");
    const [role, expiry] = payload.split(":");
    return role === "admin" && Number(expiry) > Date.now();
  } catch {
    return false;
  }
}

export async function hasAdminSession() {
  if (isDemoMode()) return true;
  const { appSecret } = getServerEnv();
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return verifySessionValue(value, appSecret);
}

export async function authenticateAdmin(password: string) {
  const { adminPassword, appSecret } = getServerEnv();
  if (!adminPassword || !appSecret) return false;
  return safeCompare(password, adminPassword);
}

export async function setAdminSession() {
  const { appSecret } = getServerEnv();
  const expiry = Date.now() + SESSION_SECONDS * 1000;
  (await cookies()).set(COOKIE_NAME, encodeSession(expiry, appSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
}

export async function clearAdminSession() {
  (await cookies()).set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
