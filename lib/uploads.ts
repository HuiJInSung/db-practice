import "server-only";
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

// 檔名只留英數字、點、底線與連字號，避免路徑或特殊字元出問題；中文檔名會變成 image
export function safeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "image";
}
