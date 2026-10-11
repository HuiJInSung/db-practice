import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError, readJson } from "@/lib/api";
import Budget, { DEFAULT_ITEMS } from "@/models/Budget";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

async function resolve(request: NextRequest, ctx: RouteContext<"/api/budgets/[month]">) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");
  const { month } = await ctx.params;
  if (!MONTH.test(month)) return jsonError(400, "月份格式應為 YYYY-MM");
  return { user: userId, month };
}

// GET /api/budgets/2026-10
// 回傳 { month, items, saved, copiedFrom }
// 這個月還沒規劃時，沿用最近一個已規劃月份的項目；連一個都沒有就用預設項目
export async function GET(request: NextRequest, ctx: RouteContext<"/api/budgets/[month]">) {
  const filter = await resolve(request, ctx);
  if (filter instanceof Response) return filter;

  try {
    await connectDB();
    const budget = await Budget.findOne(filter).lean();
    if (budget) {
      return Response.json({ month: filter.month, items: budget.items, saved: true, copiedFrom: null });
    }
    const previous = await Budget.findOne({ user: filter.user, month: { $lt: filter.month } })
      .sort({ month: -1 })
      .lean();
    const items = previous
      ? previous.items.map(({ type, name, amount }) => ({ type, name, amount }))
      : DEFAULT_ITEMS;
    return Response.json({ month: filter.month, items, saved: false, copiedFrom: previous?.month ?? null });
  } catch (err) {
    return handleError(err);
  }
}

// PUT /api/budgets/2026-10  body: { items: [{ type, name, amount }] }
// 整份覆蓋這個月的規劃
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/budgets/[month]">) {
  const filter = await resolve(request, ctx);
  if (filter instanceof Response) return filter;

  const body = await readJson(request);
  if (!body || !Array.isArray(body.items)) return jsonError(400, "請傳入 { items: [...] }");

  // 只取出允許的欄位
  const items = (body.items as Record<string, unknown>[]).map((item) => ({
    type: item?.type,
    name: typeof item?.name === "string" ? item.name.trim() : item?.name,
    amount: item?.amount,
  }));

  const seen = new Set<string>();
  for (const item of items) {
    const key = `${item.type}:${item.name}`;
    if (seen.has(key)) {
      const kind = item.type === "income" ? "收入" : "費用";
      return jsonError(400, `${kind}項目「${item.name}」重複了`);
    }
    seen.add(key);
  }

  try {
    await connectDB();
    const budget = await Budget.findOneAndUpdate(
      filter,
      { items },
      { upsert: true, returnDocument: "after", runValidators: true }
    ).lean();
    return Response.json({ month: filter.month, items: budget!.items, saved: true, copiedFrom: null });
  } catch (err) {
    return handleError(err);
  }
}
