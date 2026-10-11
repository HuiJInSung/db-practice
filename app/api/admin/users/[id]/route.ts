import type { NextRequest } from "next/server";
import mongoose, { isValidObjectId } from "mongoose";
import { handleError, jsonError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import User from "@/models/User";
import Transaction from "@/models/Record";
import Post from "@/models/Post";
import Budget from "@/models/Budget";

// PATCH /api/admin/users/:id  body: { name?, role? }
// role 為 "admin" 或 "user"。管理者不能改自己的身份，這樣後台永遠至少有一位管理者
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這位使用者");
  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");

  const updates: Record<string, unknown> = {};
  if ("name" in body) updates.name = body.name;
  if ("role" in body) {
    if (id === admin) return jsonError(400, "不能修改自己的身份");
    updates.role = body.role; // 不是 admin / user 時由 Schema 的 enum 擋下
  }
  if (Object.keys(updates).length === 0) return jsonError(400, "沒有可修改的欄位，可修改：name, role");

  try {
    const user = await User.findByIdAndUpdate(id, updates, { returnDocument: "after", runValidators: true })
      .select("name email role")
      .lean();
    if (!user) return jsonError(404, "找不到這位使用者");
    return Response.json({ data: user });
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/admin/users/:id：連同這位使用者的記帳、文章、規劃一起刪除；不能刪除自己
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這位使用者");
  if (id === admin) return jsonError(400, "不能刪除自己的帳號");

  try {
    // 用 transaction 確保全部刪除或全部不刪，不會留下孤兒資料
    const result = await mongoose.connection.transaction(async (session) => {
      const user = await User.findByIdAndDelete(id, { session }).select("name email").lean();
      if (!user) return null;
      const records = await Transaction.deleteMany({ user: id }, { session });
      const posts = await Post.deleteMany({ user: id }, { session });
      const budgets = await Budget.deleteMany({ user: id }, { session });
      return {
        user,
        deletedRecords: records.deletedCount,
        deletedPosts: posts.deletedCount,
        deletedBudgets: budgets.deletedCount,
      };
    });
    if (!result) return jsonError(404, "找不到這位使用者");
    const { user, ...counts } = result;
    return Response.json({ data: user, ...counts });
  } catch (err) {
    return handleError(err);
  }
}
