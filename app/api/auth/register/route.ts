import type { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { handleError, jsonError, readJson } from "@/lib/api";
import { createSession } from "@/lib/session";
import { BCRYPT_ROUNDS, readCredentials, toPublicUser } from "@/lib/credentials";
import User from "@/models/User";

// POST /api/auth/register  body: { name, email, password }
// 註冊成功後直接登入（設定 session cookie）
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");

  const creds = readCredentials(body, { checkPasswordRules: true });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const details: Record<string, string> = "error" in creds ? { ...creds.details } : {};
  if (!name) details.name = "請填寫使用者名稱";
  else if (name.length > 50) details.name = "使用者名稱最多 50 個字";
  if ("error" in creds || Object.keys(details).length > 0) return jsonError(400, "資料格式錯誤", details);

  try {
    await connectDB();
    const passwordHash = await bcrypt.hash(creds.password, BCRYPT_ROUNDS);
    // 舊的「持帳人」有 email 但沒有密碼：用同一個 email 註冊時，幫它設定密碼與名稱，原本的帳本與文章都保留
    const legacy = await User.findOneAndUpdate(
      { email: creds.email, passwordHash: { $exists: false } },
      { passwordHash, name },
      { returnDocument: "after", runValidators: true }
    ).lean();
    if (legacy) {
      await createSession(legacy._id.toString());
      return Response.json({ data: toPublicUser(legacy) }, { status: 201 });
    }
    const user = await User.create({
      name,
      email: creds.email,
      passwordHash,
    });
    await createSession(user._id.toString());
    return Response.json({ data: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return handleError(err); // email 重複會在這裡回 409
  }
}
