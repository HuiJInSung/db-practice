import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError, pick, readJson } from "@/lib/api";
import Transaction, { EDITABLE_FIELDS } from "@/models/Record";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// 把 YYYY-MM-DD 當成台灣時間的那一天；endOfDay 為 true 時取當天結束（讓 to 包含整天）
function parseDay(value: string, endOfDay: boolean): Date | null {
  if (!DAY.test(value)) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setTime(date.getTime() + 24 * 60 * 60 * 1000 - 1);
  return date;
}

// GET /api/transactions?type=expense&category=餐飲&from=2026-10-01&to=2026-10-31&page=1&limit=20
// 回傳 { data, page, limit, total, summary: { income, expense } }
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const params = request.nextUrl.searchParams;
  const filter: Record<string, unknown> = { user: userId };

  const type = params.get("type");
  if (type) {
    if (type !== "income" && type !== "expense") return jsonError(400, "type 只能是 income 或 expense");
    filter.type = type;
  }

  const category = params.get("category");
  if (category) filter.category = category;

  const from = params.get("from");
  const to = params.get("to");
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const d = parseDay(from, false);
      if (!d) return jsonError(400, "from 格式應為 YYYY-MM-DD");
      range.$gte = d;
    }
    if (to) {
      const d = parseDay(to, true);
      if (!d) return jsonError(400, "to 格式應為 YYYY-MM-DD");
      range.$lte = d;
    }
    filter.date = range;
  }

  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));

  try {
    await connectDB();
    // summary：同樣條件（但不分收入/支出）下的總收入與總支出，不受分頁影響
    const summaryFilter = { ...filter };
    delete summaryFilter.type;
    const [data, total, sums] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
      Transaction.aggregate<{ _id: "income" | "expense"; sum: number }>([
        { $match: { ...summaryFilter, user: new Types.ObjectId(userId) } },
        { $group: { _id: "$type", sum: { $sum: "$amount" } } },
      ]),
    ]);
    const summary = { income: 0, expense: 0 };
    for (const s of sums) summary[s._id] = s.sum;
    return Response.json({ data, page, limit, total, summary });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/transactions  body: { type, amount, category, note?, date? }
export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");

  try {
    await connectDB();
    const transaction = await Transaction.create({ ...pick(body, EDITABLE_FIELDS), user: userId });
    return Response.json({ data: transaction }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
