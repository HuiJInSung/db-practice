import "server-only";
import {
  BlobAccessError,
  BlobContentTypeNotAllowedError,
  BlobError,
  BlobFileTooLargeError,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
} from "@vercel/blob";
import { jsonError } from "@/lib/api";

// Vercel 上的 Function 請求內容最多 4.5 MB，所以由伺服器轉傳的檔案不能超過這個大小
const MAX_BYTES = 4.5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"];

// 從 multipart/form-data 的 file 欄位取出圖片並檢查格式與大小；不合格時回傳錯誤 Response
export async function readImageFile(request: Request): Promise<File | Response> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "請選擇要上傳的圖片");
  if (!IMAGE_TYPES.includes(file.type)) return jsonError(400, "只能上傳 JPG、PNG、GIF、WebP 或 AVIF 圖片");
  if (file.size === 0) return jsonError(400, "檔案是空的");
  if (file.size > MAX_BYTES) return jsonError(413, "圖片最大 4.5 MB");
  return file;
}

// 把 Vercel Blob 的錯誤轉成看得懂的原因，回傳 502 給前端顯示；完整錯誤仍記在伺服器紀錄
export function blobErrorResponse(err: unknown) {
  console.error(err);
  return jsonError(502, `上傳到 Vercel Blob 失敗：${blobErrorReason(err)}`);
}

function blobErrorReason(err: unknown) {
  if (err instanceof BlobStoreNotFoundError) return "找不到 Blob store，BLOB_READ_WRITE_TOKEN 可能填錯了";
  if (err instanceof BlobStoreSuspendedError) return "Blob store 已被停用，請到 Vercel 檢查";
  if (err instanceof BlobAccessError) return "沒有存取權限，BLOB_READ_WRITE_TOKEN 可能無效或已過期";
  if (err instanceof BlobFileTooLargeError) return "檔案太大";
  if (err instanceof BlobContentTypeNotAllowedError) return "不允許這種檔案格式";
  if (err instanceof BlobError && err.message.includes("No blob credentials")) {
    return "伺服器沒有設定 BLOB_READ_WRITE_TOKEN 環境變數";
  }
  const message = err instanceof Error ? err.message.replace(/^Vercel Blob:\s*/, "") : String(err);
  return message || "未知錯誤";
}

// 檔名只留英數字、點、底線與連字號，避免路徑或特殊字元出問題；中文檔名會變成 image
export function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}
