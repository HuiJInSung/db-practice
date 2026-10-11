import { del, put } from "@vercel/blob";
import { handleError, jsonError } from "@/lib/api";
import { toPublicUser } from "@/lib/credentials";
import { connectDB } from "@/lib/mongoose";
import { getSessionUserId } from "@/lib/session";
import { blobErrorResponse, readImageFile, safeFileName } from "@/lib/uploads";
import User from "@/models/User";

// 刪掉 Blob 上的舊大頭照。失敗只記錄、不影響回應：資料庫已經改好了，頂多在 Blob 留下一個沒人用的檔案
async function deleteBlob(url: string | null | undefined) {
  if (!url) return;
  try {
    await del(url);
  } catch (err) {
    console.error("刪除舊大頭照失敗", url, err);
  }
}

// PUT /api/auth/me/avatar  body: multipart/form-data，欄位 file = 圖片檔
// 上傳到 Vercel Blob 的 avatars/<自己的 id>/，把回傳的公開網址存進 User.avatarUrl，再刪掉舊的那張
// 回傳 { data: 更新後的使用者（含 avatarUrl） }
export async function PUT(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  const file = await readImageFile(request);
  if (file instanceof Response) return file;

  let blobUrl: string;
  try {
    // 放在 avatars/ 而不是 uploads/，所以不會混進「圖片」頁的清單
    const blob = await put(`avatars/${userId}/${safeFileName(file.name)}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    blobUrl = blob.url;
  } catch (err) {
    return blobErrorResponse(err);
  }

  try {
    await connectDB();
    // 取回更新「前」的資料，才知道要刪哪張舊圖
    const before = await User.findByIdAndUpdate(userId, { avatarUrl: blobUrl }, { returnDocument: "before" })
      .select("name email role avatarUrl")
      .lean();
    if (!before) {
      await deleteBlob(blobUrl); // 使用者已被刪除：剛上傳的圖也用不到了
      return jsonError(401, "請先登入");
    }
    await deleteBlob(before.avatarUrl);
    return Response.json({ data: toPublicUser({ ...before, avatarUrl: blobUrl }) });
  } catch (err) {
    await deleteBlob(blobUrl); // 存進資料庫失敗：別讓剛上傳的圖變成孤兒
    return handleError(err);
  }
}

// DELETE /api/auth/me/avatar：移除大頭照（清掉資料庫欄位，並刪掉 Blob 上的檔案）
export async function DELETE() {
  const userId = await getSessionUserId();
  if (!userId) return jsonError(401, "請先登入");

  try {
    await connectDB();
    const before = await User.findByIdAndUpdate(userId, { $unset: { avatarUrl: 1 } }, { returnDocument: "before" })
      .select("name email role avatarUrl")
      .lean();
    if (!before) return jsonError(401, "請先登入");
    await deleteBlob(before.avatarUrl);
    return Response.json({ data: toPublicUser({ ...before, avatarUrl: undefined }) });
  } catch (err) {
    return handleError(err);
  }
}
