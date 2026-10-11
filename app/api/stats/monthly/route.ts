import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError } from "@/lib/api";
import Transaction from "@/models/Record";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

// 某個月（台灣時間）的起訖：[當月 1 日 00:00, 下個月 1 日 00:00)
function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];
  return {
    from: new Date(`${year}-${pad(month)}-01T00:00:00+08:00`),
    to: new Date(`${next[0]}-${pad(next[1])}-01T00:00:00+08:00`),
  };
}

// GET /api/stats/monthly?month=2026-10
// 回傳 { month, total, count, previousTotal, categories: [{ category, total, count }] }
// categories 依金額由大到小排序；previousTotal 是上個月的總支出，用來比較
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const month = request.nextUrl.searchParams.get("month") ?? "";
  const m = MONTH.exec(month);
  if (!m) return jsonError(400, "month 格式應為 YYYY-MM");
  const year = Number(m[1]);
  const mon = Number(m[2]);

  const current = monthBounds(year, mon);
  const previous = monthBounds(mon === 1 ? year - 1 : year, mon === 1 ? 12 : mon - 1);
  const user = new Types.ObjectId(userId);

  try {
    await connectDB();
    const [categories, prev] = await Promise.all([
      Transaction.aggregate<{ category: string; total: number; count: number }>([
        { $match: { user, type: "expense", date: { $gte: current.from, $lt: current.to } } },
        { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { total: -1, _id: 1 } },
        { $project: { _id: 0, category: "$_id", total: 1, count: 1 } },
      ]),
      Transaction.aggregate<{ total: number }>([
        { $match: { user, type: "expense", date: { $gte: previous.from, $lt: previous.to } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const total = categories.reduce((s, c) => s + c.total, 0);
    const count = categories.reduce((s, c) => s + c.count, 0);
    return Response.json({ month, total, count, previousTotal: prev[0]?.total ?? 0, categories });
  } catch (err) {
    return handleError(err);
  }
}
