"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useCurrentUser } from "../current-user";
import {
  api,
  errorText,
  inkButton,
  label,
  lineInput,
  textButton,
} from "../ledger-api";

type Post = {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  user?: { _id: string; name: string; avatarUrl?: string } | null; // 匿名文章沒有作者（null 或不存在）
};
type PostList = { data: Post[]; page: number; limit: number; total: number };

const PAGE_SIZE = 10;
const MAX_CONTENT = 2000;

// 2026.10.10　14:32（台灣時間）
const timeFormatter = new Intl.DateTimeFormat("zh-TW", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
function formatTime(iso: string) {
  const p = Object.fromEntries(timeFormatter.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}.${p.month}.${p.day}　${p.hour}:${p.minute}`;
}

export default function BoardApp() {
  const me = useCurrentUser();
  const userId = me?._id ?? "";

  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // GET /api/posts：載入第一頁
  useEffect(() => {
    api<PostList>(`/api/posts?page=1&limit=${PAGE_SIZE}`)
      .then((res) => {
        setPosts(res.data);
        setTotal(res.total);
        setPage(1);
        setPostsLoaded(true);
      })
      .catch((err) => setMessage({ kind: "error", text: errorText(err) }));
  }, []);

  // GET /api/posts?page=N：載入更早的文章，接在後面
  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await api<PostList>(`/api/posts?page=${page + 1}&limit=${PAGE_SIZE}`);
      // 期間若有人發文，分頁會位移；用 _id 去掉重複的
      setPosts((prev) => [...prev, ...res.data.filter((p) => !prev.some((q) => q._id === p._id))]);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setLoadingMore(false);
    }
  }

  // POST /api/posts
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPosting(true);
    setMessage(null);
    try {
      // 匿名發表時不帶使用者，後端也不會記錄作者
      const { data } = await api<{ data: Post }>("/api/posts", {
        method: "POST",
        body: JSON.stringify({ title, content, anonymous }),
      });
      setPosts((prev) => [data, ...prev]);
      setTotal((t) => t + 1);
      setTitle("");
      setContent("");
      setMessage({ kind: "ok", text: anonymous ? "已匿名貼上留言板。" : "已貼上留言板。" });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setPosting(false);
    }
  }

  // DELETE /api/posts/:id（只能刪自己的）
  async function remove(id: string) {
    setMessage(null);
    try {
      await api(`/api/posts/${id}`, { method: "DELETE" });
      setPosts((prev) => prev.filter((p) => p._id !== id));
      setTotal((t) => t - 1);
      setConfirmDeleteId(null);
      setMessage({ kind: "ok", text: "已撕下這張留言。" });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  return (
    <div className="space-y-14">
      {/* 以誰的名義留言 */}
      <section className="text-center">
        {me === null ? (
          <p className="text-sm italic text-ink-soft">
            還沒登入，只能匿名發表。想署名的話請先
            <Link href="/login" className="mx-1 border-b border-ink-faint not-italic text-ink hover:border-ink">
              登入
            </Link>
            。
          </p>
        ) : (
          <p className={`text-sm transition-opacity ${anonymous ? "opacity-40" : ""}`}>
            <span className={`${label} mr-3`}>署名</span>
            <span className="text-base">{me?.name ?? "——"}</span>
          </p>
        )}
      </section>

      {/* 寫一篇 */}
      <form
        onSubmit={submit}
        className="relative border border-rule bg-paper-raised/70 px-6 py-7 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8"
      >
        {/* 紙膠帶貼住卡片兩角 */}
        <span aria-hidden className="washi -left-7 -top-2 -rotate-[28deg]" />
        <span aria-hidden className="washi -right-7 -top-2 rotate-[24deg]" />
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-lg tracking-[0.2em]">寫一篇</h2>
          <span className="text-xs italic text-ink-faint">
            {anonymous ? "匿名發表" : me ? `以「${me.name}」署名` : ""}
          </span>
        </div>

        <label className="block">
          <span className={label}>標題</span>
          <input
            required
            maxLength={60}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${lineInput} text-lg`}
            placeholder="今天想說的事"
          />
        </label>

        <label className="mt-6 block">
          <span className={label}>內容</span>
          <textarea
            required
            maxLength={MAX_CONTENT}
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${lineInput} resize-y leading-8`}
            placeholder="慢慢寫，不急。"
          />
        </label>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex items-center gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-seal"
              />
              <span className="tracking-widest">匿名發表</span>
            </label>
            <span className="figures text-xs text-ink-faint">
              {content.length} / {MAX_CONTENT}
            </span>
          </div>
          <button type="submit" disabled={posting || (!anonymous && !userId)} className={inkButton}>
            {posting ? "張貼中…" : "張　貼"}
          </button>
        </div>
        {anonymous && (
          <p className="mt-3 text-xs italic text-expense">※ 匿名文章不會記錄作者，發表後任何人都無法刪除。</p>
        )}
      </form>

      {message && (
        <p
          role="status"
          className={`-mt-8 text-center text-sm italic ${message.kind === "ok" ? "text-income" : "text-expense"}`}
        >
          {message.kind === "ok" ? "✓ " : "※ "}
          {message.text}
        </p>
      )}

      {/* 文章列表 */}
      <section>
        <div className="mb-8 flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="text-lg tracking-[0.2em]">留言簿</h2>
          {postsLoaded && <span className="figures text-sm text-ink-faint">共 {total} 篇</span>}
        </div>

        {!postsLoaded ? (
          <p className="py-10 text-center text-sm italic text-ink-faint">翻閱中…</p>
        ) : posts.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-ink-faint">留言簿還是空白的，寫下第一篇吧。</p>
        ) : (
          <ol className="space-y-8">
            {posts.map((post) => {
              const mine = !!userId && post.user?._id === userId;
              return (
                <li key={post._id}>
                  <article
                    className={`relative border bg-paper-raised/60 px-6 py-6 sm:px-8 ${
                      mine ? "border-seal/40" : "border-rule"
                    }`}
                  >
                    {/* 自己寫的文章蓋一個小小的「親筆」章 */}
                    {mine && (
                      <span
                        aria-label="你寫的文章"
                        role="img"
                        className="seal absolute -top-3 right-5 h-9! w-9! text-[0.65rem]!"
                      >
                        親筆
                      </span>
                    )}
                    <header>
                      <h3 className="pr-10 text-xl leading-snug tracking-wider">{post.title}</h3>
                      <p className="mt-2 flex items-center text-xs tracking-widest text-ink-faint">
                        {/* 有大頭照的作者才顯示，沒有的就只顯示名字 */}
                        {post.user?.avatarUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- 外部 Blob 網址，沒有設定 next/image 的 remotePatterns
                          <img
                            src={post.user.avatarUrl}
                            alt=""
                            className="mr-2 h-6 w-6 shrink-0 rounded-full border border-rule object-cover"
                          />
                        )}
                        {post.user ? (
                          <span className="text-ink-soft">{post.user.name}</span>
                        ) : (
                          <span className="italic text-ink-soft">匿名</span>
                        )}
                        <span className="mx-2">・</span>
                        <time dateTime={post.createdAt} className="figures">
                          {formatTime(post.createdAt)}
                        </time>
                      </p>
                    </header>
                    <p className="mt-4 whitespace-pre-wrap break-words leading-8 text-ink/90">{post.content}</p>

                    {mine && (
                      <div className="mt-4 flex justify-end gap-4">
                        {confirmDeleteId === post._id ? (
                          <>
                            <span className="text-xs italic text-ink-faint">確定要撕下這篇嗎？</span>
                            <button onClick={() => remove(post._id)} className={`${textButton} text-expense hover:text-expense`}>
                              撕下
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className={textButton}>
                              留著
                            </button>
                          </>
                        ) : (
                          <button onClick={() => setConfirmDeleteId(post._id)} className={textButton}>
                            刪除
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        {postsLoaded && posts.length < total && (
          <div className="mt-10 text-center">
            <button onClick={loadMore} disabled={loadingMore} className={textButton}>
              {loadingMore ? "翻閱中…" : "— 翻看更早的留言 —"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
