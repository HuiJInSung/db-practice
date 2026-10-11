import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { isValidObjectId } from "mongoose";

const secret = process.env.SESSION_SECRET;

if (!secret) {
  throw new Error("請在 .env.local 設定 SESSION_SECRET");
}

const key = new TextEncoder().encode(secret);
const COOKIE_NAME = "session";
const MAX_AGE = 7 * 24 * 60 * 60; // 登入狀態保留 7 天（秒）

// JWT 裡只放 user id（sub），不放 email 等個資：JWT 只有簽章、沒有加密，任何人都讀得到內容
async function sign(userId: string) {
  return new SignJWT()
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key);
}

// 驗證簽章與到期時間，有效就回傳 user id，否則回傳 null
async function verify(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    return payload.sub && isValidObjectId(payload.sub) ? payload.sub : null;
  } catch {
    return null; // 被竄改、過期或格式不對
  }
}

// 登入成功後呼叫：把 JWT 存進 HTTP-only cookie
export async function createSession(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, await sign(userId), {
    httpOnly: true, // 前端 JavaScript 讀不到，XSS 偷不走
    secure: process.env.NODE_ENV === "production", // 正式環境只走 https；本機開發是 http
    sameSite: "lax", // 其他網站發起的 POST 不會帶上這個 cookie，降低 CSRF 風險
    path: "/",
    maxAge: MAX_AGE, // 關掉瀏覽器後仍保持登入
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// 取得目前登入的 user id；沒登入或 cookie 無效時回傳 null
export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return verify(cookieStore.get(COOKIE_NAME)?.value);
}
