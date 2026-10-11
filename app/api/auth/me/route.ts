import { connectDB } from "@/lib/mongoose";
import { handleError } from "@/lib/api";
import { getSessionUserId } from "@/lib/session";
import { toPublicUser } from "@/lib/credentials";
import User from "@/models/User";

// GET /api/auth/me：目前登入的使用者；沒登入時 data 是 null
// 前端重新整理後靠這支 API 恢復登入狀態（cookie 是 HTTP-only，前端自己讀不到）
export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) return Response.json({ data: null });

    await connectDB();
    const user = await User.findById(userId).select("name email role avatarUrl").lean();
    // cookie 有效但使用者已被刪除：視為沒登入
    return Response.json({ data: user ? toPublicUser(user) : null });
  } catch (err) {
    return handleError(err);
  }
}
