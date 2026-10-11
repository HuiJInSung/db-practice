import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError } from "@/lib/api";
import Post from "@/models/Post";

// DELETE /api/posts/:id：只能刪除自己寫的文章；匿名文章沒有作者，任何人都不能刪
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/posts/[id]">) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這篇文章");

  try {
    await connectDB();
    // 條件同時帶 user：別人的文章刪不到
    const post = await Post.findOneAndDelete({ _id: id, user: userId }).select("title").lean();
    if (post) return Response.json({ data: post });

    // 分辨「文章不存在」、「匿名文章」和「不是你寫的」，讓前端能顯示清楚的訊息
    const existing = await Post.findById(id).select("user").lean();
    if (!existing) return jsonError(404, "找不到這篇文章");
    if (!existing.user) return jsonError(403, "匿名文章無法刪除");
    return jsonError(403, "只能刪除自己寫的文章");
  } catch (err) {
    return handleError(err);
  }
}
