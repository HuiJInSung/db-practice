import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { handleError, jsonError, readJson } from "@/lib/api";
import { createSession } from "@/lib/session";
import { BCRYPT_ROUNDS, readCredentials, toPublicUser } from "@/lib/credentials";
import User from "@/models/User";

// 找不到使用者時也拿這個假的 hash 比對一次，讓「帳號不存在」和「密碼錯誤」花的時間一樣，
// 攻擊者就無法從回應速度猜出哪些 email 有註冊
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_ROUNDS);

// POST /api/auth/login  body: { email, password }
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");

  const creds = readCredentials(body);
  if ("error" in creds) return jsonError(400, creds.error, creds.details);

  try {
    await connectDB();
    // passwordHash 在 schema 設了 select: false，要明確加上 + 才會取出
    const user = await User.findOne({ email: creds.email }).select("+passwordHash").lean();
    const ok = await bcrypt.compare(creds.password, user?.passwordHash ?? DUMMY_HASH);
    // 不管是 email 不存在還是密碼錯，都回同一個訊息
    if (!user?.passwordHash || !ok) return jsonError(401, "email 或密碼錯誤");

    await createSession(user._id.toString());
    return Response.json({ data: toPublicUser(user) });
  } catch (err) {
    return handleError(err);
  }
}
