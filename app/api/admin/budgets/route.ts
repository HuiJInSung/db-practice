import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { pageParams, requireAdmin } from "@/lib/admin";
import Budget from "@/models/Budget";
import "@/models/User"; // populate("user") 需要 User model 已註冊

// GET /api/admin/budgets?user=<id>&page=1&limit=20：所有人的每月規劃，新的月份在前
// 回傳 { data: [{ _id, month, user: { _id, name, email }, income, expense, items }], page, limit, total }
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
    const [budgets, total] = await Promise.all([
      Budget.find(filter).sort({ month: -1, _id: -1 }).skip(skip).limit(limit).populate("user", "name email").lean(),
      Budget.countDocuments(filter),
    ]);
    const sum = (items: { type: string; amount: number }[], type: string) =>
      items.filter((i) => i.type === type).reduce((s, i) => s + i.amount, 0);
    const data = budgets.map((b) => ({ ...b, income: sum(b.items, "income"), expense: sum(b.items, "expense") }));
    return Response.json({ data, page, limit, total });
  } catch (err) {
    return handleError(err);
  }
}
