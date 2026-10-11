import "server-only";

// bcrypt 的計算成本：每 +1 慢一倍。10 在一般電腦上約 50–100ms，暴力破解很慢、登入又不會卡
export const BCRYPT_ROUNDS = 10;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Credentials = { email: string; password: string };
type CredentialsError = { error: string; details: Record<string, string> };

// 從 body 取出 email 與密碼並做基本檢查。
// 註冊時才檢查密碼規則；登入時不檢查，避免透露「密碼規則」以外的資訊，也讓舊規則的密碼仍能登入
export function readCredentials(
  body: Record<string, unknown>,
  { checkPasswordRules = false } = {}
): Credentials | CredentialsError {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const details: Record<string, string> = {};

  if (!EMAIL_RE.test(email)) details.email = "email 格式不正確";
  if (!password) details.password = "請填寫密碼";
  else if (checkPasswordRules && password.length < 8) details.password = "密碼至少 8 個字元";
  // bcrypt 只看前 72 bytes，超過的部分會被忽略，所以直接擋掉
  else if (new TextEncoder().encode(password).length > 72) details.password = "密碼太長了";

  if (Object.keys(details).length > 0) return { error: "資料格式錯誤", details };
  return { email, password };
}

// 回傳給前端的使用者資料（絕對不能包含 passwordHash）
export function toPublicUser(user: {
  _id: unknown;
  name: string;
  email?: string | null;
  role?: string | null;
  avatarUrl?: string | null;
}) {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email ?? undefined,
    role: user.role === "admin" ? "admin" : "user",
    avatarUrl: user.avatarUrl ?? undefined,
  };
}
