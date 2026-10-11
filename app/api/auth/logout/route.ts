import { deleteSession } from "@/lib/session";

// POST /api/auth/logout：刪除 session cookie
// JWT 本身在到期前仍然有效，所以登出一定要靠刪 cookie；不用 GET 是避免被 <img src> 之類的連結觸發
export async function POST() {
  await deleteSession();
  return Response.json({ ok: true });
}
