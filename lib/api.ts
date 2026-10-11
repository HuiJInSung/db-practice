import mongoose from "mongoose";

export function jsonError(status: number, error: string, details?: unknown) {
  return Response.json(details === undefined ? { error } : { error, details }, { status });
}

// 把 Mongoose 的驗證錯誤轉成 400，其他未預期的錯誤回 500
export function handleError(err: unknown) {
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([field, e]) => [field, e.message])
    );
    return jsonError(400, "資料格式錯誤", details);
  }
  if (err instanceof mongoose.Error.CastError) {
    return jsonError(400, `欄位 ${err.path} 格式錯誤`);
  }
  // unique 索引重複（例如 email 已被使用）
  if (err && typeof err === "object" && "code" in err && err.code === 11000) {
    const field = Object.keys((err as { keyPattern?: object }).keyPattern ?? {})[0] ?? "資料";
    return jsonError(409, `這個 ${field} 已經有人使用了`, { [field]: `這個 ${field} 已經有人使用了` });
  }
  console.error(err);
  return jsonError(500, "伺服器錯誤");
}

// 讀取 JSON body；格式不對時回傳 null
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

// 只取出允許前端修改的欄位，避免前端偷改 user、_id 等欄位
export function pick(body: Record<string, unknown>, keys: readonly string[]) {
  return Object.fromEntries(keys.filter((k) => k in body).map((k) => [k, body[k]]));
}
