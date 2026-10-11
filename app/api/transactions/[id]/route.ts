import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError, pick, readJson } from "@/lib/api";
import Transaction, { EDITABLE_FIELDS } from "@/models/Record";

// 先確認登入與 id 格式，回傳查詢條件；有問題時回傳錯誤 Response
async function resolve(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");
  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這筆紀錄");
  // 條件同時帶 user：只能存取自己的紀錄，別人的紀錄一律當作找不到
  return { _id: id, user: userId };
}

// GET /api/transactions/:id
export async function GET(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const filter = await resolve(request, ctx);
  if (filter instanceof Response) return filter;

  try {
    await connectDB();
    const transaction = await Transaction.findOne(filter).lean();
    if (!transaction) return jsonError(404, "找不到這筆紀錄");
    return Response.json({ data: transaction });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH /api/transactions/:id  body: 要修改的欄位（type / amount / category / note / date）
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const filter = await resolve(request, ctx);
  if (filter instanceof Response) return filter;

  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");
  const updates = pick(body, EDITABLE_FIELDS);
  if (Object.keys(updates).length === 0) {
    return jsonError(400, `沒有可修改的欄位，可修改：${EDITABLE_FIELDS.join(", ")}`);
  }

  try {
    await connectDB();
    const transaction = await Transaction.findOneAndUpdate(filter, updates, {
      returnDocument: "after", // 回傳修改後的資料
      runValidators: true, // 修改時也套用 Schema 驗證
    }).lean();
    if (!transaction) return jsonError(404, "找不到這筆紀錄");
    return Response.json({ data: transaction });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/transactions/:id
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/transactions/[id]">) {
  const filter = await resolve(request, ctx);
  if (filter instanceof Response) return filter;

  try {
    await connectDB();
    const transaction = await Transaction.findOneAndDelete(filter).lean();
    if (!transaction) return jsonError(404, "找不到這筆紀錄");
    return Response.json({ data: transaction });
  } catch (err) {
    return handleError(err);
  }
}
