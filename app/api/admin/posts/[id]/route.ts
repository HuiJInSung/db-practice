import type { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import Post from "@/models/Post";

// DELETE /api/admin/posts/:id：刪除任何文章，包含匿名文章（列表直接用公開的 GET /api/posts）
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/posts/[id]">) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return jsonError(404, "找不到這篇文章");

  try {
    const post = await Post.findByIdAndDelete(id).select("title").lean();
    if (!post) return jsonError(404, "找不到這篇文章");
    return Response.json({ data: post });
  } catch (err) {
    return handleError(err);
  }
}
