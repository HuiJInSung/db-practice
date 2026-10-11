import { list, put } from "@vercel/blob";
import { isValidObjectId } from "mongoose";
import { handleError, jsonError } from "@/lib/api";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { blobErrorResponse, readImageFile, safeFileName } from "@/lib/uploads";
import User from "@/models/User";

// GET /api/uploads：列出已上傳的圖片（直接讀 Vercel Blob，不經過資料庫）
// 一般使用者只看得到自己資料夾 uploads/<自己的 id>/ 裡的圖片；管理者看得到所有人的，並附上上傳者
// 回傳 { data: [{ url, pathname, size, uploadedAt, owner: { _id, name } | null }] }，新的在前
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  try {
    await connectDB();
    const me = await User.findById(userId).select("role").lean();
    if (!me) return jsonError(401, "請先登入");
    const isAdmin = me.role === "admin";

    // list() 一次最多回 1000 筆，用 cursor 把剩下的接著取完
    const prefix = isAdmin ? "uploads/" : `uploads/${userId}/`;
    const blobs = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    // 路徑第二段就是上傳者的 id，一次查出所有名稱
    const ownerIdOf = (pathname: string) => pathname.split("/")[1];
    const ownerIds = [...new Set(blobs.map((b) => ownerIdOf(b.pathname)))].filter((id) => isValidObjectId(id));
    const owners = await User.find({ _id: { $in: ownerIds } })
      .select("name")
      .lean();
    const nameOf = new Map(owners.map((u) => [String(u._id), u.name]));

    const data = blobs
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map((b) => {
        const ownerId = ownerIdOf(b.pathname);
        return {
          url: b.url,
          pathname: b.pathname,
          size: b.size,
          uploadedAt: b.uploadedAt,
          owner: nameOf.has(ownerId) ? { _id: ownerId, name: nameOf.get(ownerId) } : null,
        };
      });
    return Response.json({ data });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/uploads  body: multipart/form-data，欄位 file = 圖片檔
// 上傳到 Vercel Blob（金鑰從環境變數 BLOB_READ_WRITE_TOKEN 自動讀取），回傳 { data: { url, pathname, contentType, size } }
// 這裡只上傳；要當大頭照請用 PUT /api/auth/me/avatar，那支會把網址存進資料庫
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const file = await readImageFile(request);
  if (file instanceof Response) return file;
  const safeName = safeFileName(file.name);

  try {
    // 依使用者分資料夾；addRandomSuffix 讓同名檔案不會互相覆蓋
    const blob = await put(`uploads/${userId}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return Response.json(
      { data: { url: blob.url, pathname: blob.pathname, contentType: file.type, size: file.size } },
      { status: 201 }
    );
  } catch (err) {
    return blobErrorResponse(err);
  }
}
