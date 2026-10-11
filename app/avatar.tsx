"use client";

import { useRef, useState } from "react";
import { AUTH_EVENT, errorText, textButton, type ApiError, type User } from "./ledger-api";

// 與 lib/uploads.ts 的限制一致；前端先擋一次，省得傳了才被拒絕
const MAX_BYTES = 4.5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif";

// 圓形大頭照；沒有設定時顯示名字的第一個字
export function Avatar({ user, className = "h-8 w-8 text-sm" }: { user: Pick<User, "name" | "avatarUrl">; className?: string }) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- 外部 Blob 網址，沒有設定 next/image 的 remotePatterns
    return <img src={user.avatarUrl} alt="" className={`shrink-0 rounded-full border border-rule object-cover ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-rule bg-paper-raised text-ink-soft ${className}`}
    >
      {[...user.name.trim()][0] ?? "?"}
    </span>
  );
}

// 上傳或移除自己的大頭照。成功後發出 AUTH_EVENT，頁首等地方會重新讀取 /api/auth/me
export function AvatarEditor({ user }: { user: User }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "PUT" | "DELETE", file?: File) {
    setBusy(true);
    setError(null);
    try {
      // 用 FormData 送出時不能自己設 Content-Type（瀏覽器要補 boundary），所以不用共用的 api()
      let body: FormData | undefined;
      if (file) {
        body = new FormData();
        body.append("file", file);
      }
      const res = await fetch("/api/auth/me/avatar", { method, body });
      const json = await res.json().catch(() => ({ error: `請求失敗（${res.status}）` }));
      if (!res.ok) throw json as ApiError;
      window.dispatchEvent(new Event(AUTH_EVENT));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function choose(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) return setError("只能上傳 JPG、PNG、GIF、WebP 或 AVIF 圖片");
    if (file.size > MAX_BYTES) return setError("圖片最大 4.5 MB");
    send("PUT", file);
  }

  return (
    <div className="flex items-center gap-5">
      <Avatar user={user} className="h-20 w-20 text-2xl" />
      <div className="space-y-2">
        <div className="flex gap-4">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={textButton}>
            {busy ? "處理中…" : user.avatarUrl ? "更換大頭照" : "上傳大頭照"}
          </button>
          {user.avatarUrl && (
            <button type="button" onClick={() => send("DELETE")} disabled={busy} className={textButton}>
              移除
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => choose(e.target.files?.[0])}
          className="sr-only"
          tabIndex={-1}
        />
        {error && <p className="text-sm italic text-expense">※ {error}</p>}
      </div>
    </div>
  );
}
