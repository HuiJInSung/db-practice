import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import Transaction from "@/models/Record";

// DELETE /api/admin/records/:id：刪除任何人的記帳紀錄
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/records/[id]">) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這筆紀錄");

  try {
    const record = await Transaction.findByIdAndDelete(id).lean();
    if (!record) return jsonError(404, "找不到這筆紀錄");
    return Response.json({ data: record });
  } catch (err) {
    return handleError(err);
  }
}
