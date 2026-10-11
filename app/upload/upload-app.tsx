"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AvatarEditor } from "../avatar";
import { LoginPrompt, useCurrentUser } from "../current-user";
import { api, errorText, inkButton, label, textButton, toDay, type ApiError } from "../ledger-api";

// 與 app/api/uploads/route.ts 的限制一致；前端先擋一次，省得傳了才被拒絕
const MAX_BYTES = 4.5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/avif";

// 從 GET /api/uploads 讀回來的圖片；owner 是上傳者（管理者看全部時用來分辨）
type Photo = { url: string; pathname: string; size: number; uploadedAt: string; owner: { _id: string; name: string } | null };

const fileSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

// 上傳一個檔案。用 FormData 送出時不能自己設 Content-Type，瀏覽器會補上 multipart 的 boundary，
// 所以這裡不用共用的 api()
async function uploadFile(file: File): Promise<void> {
  const body = new FormData();
  body.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body });
  const json = await res.json().catch(() => ({ error: `上傳失敗（${res.status}）` }));
  if (!res.ok) throw json as ApiError;

}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className={textButton}
    >
      {copied ? "已複製" : "複製連結"}
    </button>
  );
}

export default function UploadApp() {
  const me = useCurrentUser();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ file: File; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 已上傳的圖片：每次都從 Vercel Blob 讀回來（一般使用者是自己的、管理者是全部）
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const userId = me?._id;
  const isAdmin = me?.role === "admin";
  const file = picked?.file ?? null;
  const preview = picked?.preview ?? null;

  // 本機預覽用的 blob: 網址會佔記憶體：換檔案時釋放舊的，離開頁面時釋放最後一個
  const previewRef = useRef<string | null>(null);
  function setFile(next: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next ? URL.createObjectURL(next) : null;
    setPicked(next && previewRef.current ? { file: next, preview: previewRef.current } : null);
  }
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, []);

  // GET /api/uploads：登入的使用者換人或剛上傳完時重新讀取
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api<{ data: Photo[] }>("/api/uploads")
      .then((res) => {
        if (cancelled) return;
        setPhotos(res.data);
        setListError(null);
      })
      .catch((err) => !cancelled && setListError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  function choose(next: File | undefined) {
    setError(null);
    if (!next) return setFile(null);
    if (!ACCEPT.split(",").includes(next.type)) {
      setError("只能上傳 JPG、PNG、GIF、WebP 或 AVIF 圖片");
      return setFile(null);
    }
    if (next.size > MAX_BYTES) {
      setError(`圖片最大 4.5 MB，這張有 ${fileSize(next.size)}`);
      return setFile(null);
    }
    setFile(next);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFile(file);
      setReloadKey((k) => k + 1); // 重新讀取清單，剛上傳的圖片會出現在最上面
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setError(errorText(err));
    } finally {
      setUploading(false);
    }
  }

  if (me === undefined) return <p className="py-10 text-center text-sm italic text-ink-faint">確認身份中…</p>;
  if (me === null) return <LoginPrompt>才能上傳圖片。</LoginPrompt>;

  return (
    <div className="space-y-12">
      <section>
        <div className="mb-6 border-b border-ink pb-2">
          <h2 className="text-lg tracking-[0.2em]">我的大頭照</h2>
        </div>
        <AvatarEditor user={me} />
      </section>

      <form
        onSubmit={submit}
        className="relative border border-rule bg-paper-raised/70 px-6 py-7 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8"
      >
        <span aria-hidden className="washi -left-7 -top-2 -rotate-[28deg]" />
        <span aria-hidden className="washi -right-7 -top-2 rotate-[24deg]" />
        <h2 className="mb-6 text-lg tracking-[0.2em]">上傳圖片</h2>

        {/* 整塊都可以點，也可以把圖片拖進來 */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            choose(e.dataTransfer.files[0]);
          }}
          className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 border border-dashed border-ink/30 px-4 py-6 text-center transition-colors hover:border-ink/60 hover:bg-ink/[0.03]"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- 本機 blob: 預覽網址，不適合用 next/image
            <img src={preview} alt="準備上傳的圖片預覽" className="max-h-64 max-w-full object-contain" />
          ) : (
            <span className="text-sm italic text-ink-soft">點一下選擇圖片，或把圖片拖到這裡</span>
          )}
          {file && (
            <span className="text-xs text-ink-faint">
              {file.name}・{fileSize(file.size)}
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => choose(e.target.files?.[0])}
            className="sr-only"
          />
        </label>
        <p className="mt-3 text-xs text-ink-faint">支援 JPG、PNG、GIF、WebP、AVIF，單張最大 4.5 MB。</p>

        {error && <p className="mt-4 text-sm italic text-expense">※ {error}</p>}

        <div className="mt-6 text-center">
          <button type="submit" disabled={!file || uploading} className={inkButton}>
            {uploading ? "上傳中…" : "上　傳"}
          </button>
        </div>
      </form>

      <section>
        <div className="mb-6 flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="text-lg tracking-[0.2em]">{isAdmin ? "所有人的圖片" : "我的圖片"}</h2>
          {photos && <span className={label}>共 {photos.length} 張</span>}
        </div>
        {listError && <p className="mb-4 text-sm italic text-expense">※ {listError}</p>}
        {!photos ? (
          !listError && <p className="py-8 text-center text-sm italic text-ink-faint">翻閱中…</p>
        ) : photos.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-ink-faint">還沒有上傳過圖片。</p>
        ) : (
          <ul className="space-y-6">
            {photos.map((u) => (
              <li key={u.url} className="flex gap-4">
                <a href={u.url} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 外部 Blob 網址，沒有設定 next/image 的 remotePatterns */}
                  <img src={u.url} alt="" className="h-20 w-20 border border-rule object-cover" />
                </a>
                <div className="min-w-0 flex-1">
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-ink underline decoration-ink-faint underline-offset-4 hover:decoration-ink"
                  >
                    {u.url}
                  </a>
                  <p className="mt-1 text-xs text-ink-faint">
                    {isAdmin && <span className="text-ink-soft">{u.owner?.name ?? "（已刪除的使用者）"}・</span>}
                    <span className="figures">{toDay(u.uploadedAt)}</span>・{fileSize(u.size)}
                  </p>
                  <div className="mt-2">
                    <CopyButton text={u.url} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
