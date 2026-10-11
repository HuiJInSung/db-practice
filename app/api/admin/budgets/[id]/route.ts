import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import Budget from "@/models/Budget";

// DELETE /api/admin/budgets/:id：刪除某人某個月的規劃
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/budgets/[id]">) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這份規劃");

  try {
    const budget = await Budget.findByIdAndDelete(id).select("month").lean();
    if (!budget) return jsonError(404, "找不到這份規劃");
    return Response.json({ data: budget });
  } catch (err) {
    return handleError(err);
  }
}
