import "server-only";
import { connectDB } from "./mongoose";
import { jsonError } from "./api";
import { getSessionUserId } from "./session";
import User from "@/models/User";

// 後台 API 共用：確認目前登入的是管理者，是的話回傳他的 user id，否則回傳錯誤 Response。
// 身份不放進 JWT，每次都查資料庫：取消管理者身份後立刻生效，不用等 cookie 過期
export async function requireAdmin(): Promise<string | Response> {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");
  await connectDB();
  const user = await User.findById(userId).select("role").lean();
  if (user?.role !== "admin") return jsonError(403, "只有管理者可以使用後台");
  return userId;
}

// 後台列表共用的分頁參數
export function pageParams(params: URLSearchParams, maxLimit = 100) {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}
