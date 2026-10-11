import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { pageParams, requireAdmin } from "@/lib/admin";
import Transaction from "@/models/Record";
import "@/models/User"; // populate("user") 需要 User model 已註冊

// GET /api/admin/records?user=<id>&page=1&limit=20：所有人的記帳紀錄，新的在前；user 可篩選某位使用者
// 回傳 { data: [{ ..., user: { _id, name, email } }], page, limit, total }
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const params = request.nextUrl.searchParams;
  const filter: Record<string, unknown> = {};
  const user = params.get("user");
  if (user) {
    if (!isValidObjectId(user)) return jsonError(400, "user 格式錯誤");
    filter.user = user;
  }
  const { page, limit, skip } = pageParams(params);

  try {
    const [data, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit).populate("user", "name email").lean(),
      Transaction.countDocuments(filter),
    ]);
    return Response.json({ data, page, limit, total });
  } catch (err) {
    return handleError(err);
  }
}
