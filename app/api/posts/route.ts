import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { handleError, jsonError, pick, readJson } from "@/lib/api";
import Post, { POST_FIELDS } from "@/models/Post";
import "@/models/User"; // populate("user") 需要 User model 已註冊

// GET /api/posts?page=1&limit=10：留言板所有文章，新的在前（唯讀，任何人都能看）
// 回傳 { data: [{ _id, title, content, createdAt, user: { _id, name } | null }], page, limit, total }
// user 為 null（或不存在）代表匿名文章
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10));

  try {
    await connectDB();
    const [data, total] = await Promise.all([
      Post.find()
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("user", "name avatarUrl")
        .select("title content user createdAt")
        .lean(),
      Post.countDocuments(),
    ]);
    return Response.json({ data, page, limit, total });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/posts  body: { title, content, anonymous? }
// 一般文章的作者是目前的使用者；anonymous 為 true 時不記錄作者（不需要選擇使用者，之後也無法刪除）
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (!body) return jsonError(400, "請傳入 JSON 物件");

  const anonymous = body.anonymous === true;
  const userId = anonymous ? undefined : await getSessionUserId();
  if (!anonymous && !userId) return jsonError(401, "請先登入，或勾選匿名發表");

  try {
    await connectDB();
    const post = await Post.create({ ...pick(body, POST_FIELDS), user: userId });
    const populated = await post.populate("user", "name avatarUrl");
    return Response.json(
      {
        data: {
          _id: populated._id,
          title: populated.title,
          content: populated.content,
          createdAt: populated.createdAt,
          user: populated.user ?? null, // 匿名文章為 null
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
