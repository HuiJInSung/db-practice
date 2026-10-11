"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoginPrompt, useCurrentUser } from "../current-user";
import { api, errorText, label, lineInput, money, textButton, toDay } from "../ledger-api";

type AdminUser = {
  _id: string;
  name: string;
  email?: string;
  role: "admin" | "user";
  hasPassword: boolean;
  createdAt?: string;
  records: number;
  posts: number;
  budgets: number;
};
type Owner = { _id: string; name: string; email?: string } | null;
type Paged<T> = { data: T[]; page: number; limit: number; total: number };
type AdminRecord = {
  _id: string;
  user: Owner;
  type: "income" | "expense";
  amount: number;
  category: string;
  note?: string;
  date: string;
};
type AdminPost = { _id: string; title: string; content: string; createdAt: string; user?: Owner };
type AdminBudget = {
  _id: string;
  user: Owner;
  month: string;
  income: number;
  expense: number;
  items: { _id: string; type: "income" | "expense"; name: string; amount: number }[];
};

const PAGE_SIZE = 20;
const SECTIONS = [
  { key: "users", label: "使用者" },
  { key: "records", label: "記帳" },
  { key: "posts", label: "留言" },
  { key: "budgets", label: "規劃" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const card =
  "border border-rule bg-paper-raised px-5 py-6 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-7";
const ownerName = (u: Owner | undefined) => (u ? u.name : "（已刪除或匿名）");

// ---- 共用小元件 -------------------------------------------------------------

// 需要確認的按鈕：按一下先問「確定？」，再按一次才真的執行
function ConfirmButton({
  label: text,
  confirmLabel,
  onConfirm,
  danger = false,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  danger?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const tone = danger ? "text-expense hover:text-expense" : "text-seal hover:text-seal";

  if (!confirming) {
    return (
      <button onClick={() => setConfirming(true)} className={`${textButton} ${danger ? "hover:text-expense" : ""}`}>
        {text}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-3">
      <button
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
        disabled={busy}
        className={`${textButton} ${tone}`}
      >
        {busy ? "處理中…" : confirmLabel}
      </button>
      <button onClick={() => setConfirming(false)} className={textButton}>
        取消
      </button>
    </span>
  );
}

function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-6 text-sm">
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} className={textButton}>
        ← 上一頁
      </button>
      <span className="figures text-ink-faint">
        {page} / {pages}
      </span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pages} className={textButton}>
        下一頁 →
      </button>
    </div>
  );
}

function UserFilter({ users, value, onChange }: { users: AdminUser[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="mb-5 flex items-baseline gap-3 text-sm">
      <label htmlFor="admin-user-filter" className={label}>
        使用者
      </label>
      <select
        id="admin-user-filter"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer border-0 border-b border-rule bg-transparent py-1 pr-6 outline-none focus:border-ink"
      >
        <option value="" className="bg-paper-raised text-ink">
          全部
        </option>
        {users.map((u) => (
          <option key={u._id} value={u._id} className="bg-paper-raised text-ink">
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// 載入一個分頁列表；改條件或呼叫 reload() 時重新載入
function usePaged<T>(url: string) {
  const [list, setList] = useState<Paged<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<Paged<T>>(url)
      .then((res) => {
        if (cancelled) return;
        setList(res);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorText(err)));
    return () => {
      cancelled = true;
    };
  }, [url, reloadKey]);

  return { list, error, setError, reload: () => setReloadKey((k) => k + 1) };
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="py-8 text-center text-sm italic text-ink-faint">{children}</p>
);
const ErrorLine = ({ text }: { text: string | null }) =>
  text ? <p className="mb-4 text-center text-sm italic text-expense">※ {text}</p> : null;

// ---- 使用者 -----------------------------------------------------------------

function UsersPanel({ users, meId, onChanged }: { users: AdminUser[]; meId: string; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function rename(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/admin/users/${editingId}`, { method: "PATCH", body: JSON.stringify({ name }) });
      setEditingId(null);
      setError(null);
      setNotice("已更新名稱。");
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function changeRole(u: AdminUser, role: AdminUser["role"]) {
    try {
      await api(`/api/admin/users/${u._id}`, { method: "PATCH", body: JSON.stringify({ role }) });
      setError(null);
      setNotice(`已將「${u.name}」${role === "admin" ? "設為管理者" : "改為一般使用者"}。`);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(u: AdminUser) {
    try {
      const res = await api<{ deletedRecords: number; deletedPosts: number; deletedBudgets: number }>(
        `/api/admin/users/${u._id}`,
        { method: "DELETE" }
      );
      setError(null);
      setNotice(
        `已刪除「${u.name}」，連同 ${res.deletedRecords} 筆記帳、${res.deletedPosts} 篇文章、${res.deletedBudgets} 份規劃。`
      );
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className={card}>
      <ErrorLine text={error} />
      {notice && <p className="mb-4 text-center text-sm italic text-income">✓ {notice}</p>}
      <ul>
        {users.map((u) => (
          <li key={u._id} className="border-b border-rule py-4 last:border-b-0">
            {editingId === u._id ? (
              <form onSubmit={rename} className="flex items-end gap-3">
                <input
                  autoFocus
                  required
                  maxLength={50}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="使用者名稱"
                  className={`${lineInput} flex-1`}
                />
                <button type="submit" className={`${textButton} pb-2 text-ink`}>
                  存檔
                </button>
                <button type="button" onClick={() => setEditingId(null)} className={`${textButton} pb-2`}>
                  取消
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="flex items-baseline gap-2">
                  <span className="tracking-wider">{u.name}</span>
                  {u.role === "admin" && (
                    <span className="border border-seal/60 px-1.5 text-[0.65rem] tracking-widest text-seal">管理者</span>
                  )}
                  {u._id === meId && <span className="text-xs italic text-ink-faint">（你）</span>}
                </p>
                <span className="flex gap-4">
                  <button
                    onClick={() => {
                      setEditingId(u._id);
                      setName(u.name);
                      setNotice(null);
                    }}
                    className={textButton}
                  >
                    改名
                  </button>
                  {/* 自己的身份與帳號不能在這裡改或刪，確保後台至少有一位管理者 */}
                  {u._id !== meId && (
                    <>
                      <ConfirmButton
                        label={u.role === "admin" ? "改為一般使用者" : "設為管理者"}
                        confirmLabel={u.role === "admin" ? "確定取消管理者" : "確定設為管理者"}
                        onConfirm={() => changeRole(u, u.role === "admin" ? "user" : "admin")}
                      />
                      <ConfirmButton label="刪除" confirmLabel="確定刪除" danger onConfirm={() => remove(u)} />
                    </>
                  )}
                </span>
              </div>
            )}
            <p className="mt-1 text-xs text-ink-soft">
              {u.email ?? "（沒有 email）"}
              {!u.hasPassword && <span className="ml-2 italic text-ink-faint">・尚未設定密碼，還不能登入</span>}
            </p>
            <p className="figures mt-1 text-xs text-ink-faint">
              記帳 {u.records} 筆・文章 {u.posts} 篇・規劃 {u.budgets} 份
              {u.createdAt && <>・{toDay(u.createdAt)} 建立</>}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- 記帳 -------------------------------------------------------------------

function RecordsPanel({ users, onChanged }: { users: AdminUser[]; onChanged: () => void }) {
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (userId) params.set("user", userId);
  const { list, error, setError, reload } = usePaged<AdminRecord>(`/api/admin/records?${params}`);

  async function remove(id: string) {
    try {
      await api(`/api/admin/records/${id}`, { method: "DELETE" });
      if (list && list.data.length === 1 && page > 1) setPage(page - 1);
      reload();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className={card}>
      <UserFilter
        users={users}
        value={userId}
        onChange={(id) => {
          setUserId(id);
          setPage(1);
        }}
      />
      <ErrorLine text={error} />
      {!list ? (
        <Empty>翻閱中…</Empty>
      ) : list.data.length === 0 ? (
        <Empty>沒有記帳紀錄。</Empty>
      ) : (
        <>
          <p className="mb-2 text-right text-xs text-ink-faint">共 {list.total} 筆</p>
          <ul>
            {list.data.map((r) => (
              <li key={r._id} className="flex items-baseline gap-4 border-b border-rule py-3 last:border-b-0">
                <span className="figures w-20 shrink-0 text-xs text-ink-faint">{toDay(r.date)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="tracking-wider">{r.category}</span>
                    {r.note && <span className="ml-2 text-sm text-ink-soft">{r.note}</span>}
                  </p>
                  <p className="text-xs text-ink-faint">{ownerName(r.user)}</p>
                </div>
                <span className={`figures shrink-0 ${r.type === "income" ? "text-income" : "text-expense"}`}>
                  {r.type === "income" ? "+" : "−"}
                  {money(r.amount)}
                </span>
                <ConfirmButton label="刪除" confirmLabel="確定刪除" danger onConfirm={() => remove(r._id)} />
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

// ---- 留言 -------------------------------------------------------------------

function PostsPanel({ onChanged }: { onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const { list, error, setError, reload } = usePaged<AdminPost>(`/api/posts?page=${page}&limit=${PAGE_SIZE}`);

  async function remove(id: string) {
    try {
      await api(`/api/admin/posts/${id}`, { method: "DELETE" });
      if (list && list.data.length === 1 && page > 1) setPage(page - 1);
      reload();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className={card}>
      <ErrorLine text={error} />
      {!list ? (
        <Empty>翻閱中…</Empty>
      ) : list.data.length === 0 ? (
        <Empty>留言板上沒有文章。</Empty>
      ) : (
        <>
          <p className="mb-2 text-right text-xs text-ink-faint">共 {list.total} 篇</p>
          <ul>
            {list.data.map((p) => (
              <li key={p._id} className="border-b border-rule py-4 last:border-b-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="min-w-0 truncate tracking-wider">{p.title}</p>
                  <ConfirmButton label="刪除" confirmLabel="確定刪除" danger onConfirm={() => remove(p._id)} />
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  {p.user ? p.user.name : <span className="italic">匿名</span>}・{toDay(p.createdAt)}
                </p>
                <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-ink-soft">{p.content}</p>
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

// ---- 規劃 -------------------------------------------------------------------

function BudgetsPanel({ users, onChanged }: { users: AdminUser[]; onChanged: () => void }) {
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (userId) params.set("user", userId);
  const { list, error, setError, reload } = usePaged<AdminBudget>(`/api/admin/budgets?${params}`);

  async function remove(id: string) {
    try {
      await api(`/api/admin/budgets/${id}`, { method: "DELETE" });
      if (list && list.data.length === 1 && page > 1) setPage(page - 1);
      reload();
      onChanged();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <section className={card}>
      <UserFilter
        users={users}
        value={userId}
        onChange={(id) => {
          setUserId(id);
          setPage(1);
        }}
      />
      <ErrorLine text={error} />
      {!list ? (
        <Empty>翻閱中…</Empty>
      ) : list.data.length === 0 ? (
        <Empty>還沒有人儲存過規劃。</Empty>
      ) : (
        <>
          <p className="mb-2 text-right text-xs text-ink-faint">共 {list.total} 份</p>
          <ul>
            {list.data.map((b) => (
              <li key={b._id} className="border-b border-rule py-4 last:border-b-0">
                <div className="flex items-baseline justify-between gap-4">
                  <p>
                    <span className="figures tracking-wider">{b.month}</span>
                    <span className="ml-3 text-sm text-ink-soft">{ownerName(b.user)}</span>
                  </p>
                  <ConfirmButton label="刪除" confirmLabel="確定刪除" danger onConfirm={() => remove(b._id)} />
                </div>
                <p className="figures mt-1 text-sm">
                  <span className="text-income">收入 {money(b.income)}</span>
                  <span className="mx-2 text-ink-faint">−</span>
                  <span className="text-expense">費用 {money(b.expense)}</span>
                  <span className="mx-2 text-ink-faint">=</span>
                  <span className={b.income - b.expense < 0 ? "text-expense" : ""}>結餘 {money(b.income - b.expense)}</span>
                </p>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-xs tracking-widest text-ink-faint hover:text-ink">
                    {b.items.length} 個項目
                  </summary>
                  <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                    {b.items.map((i) => (
                      <li key={i._id} className="flex justify-between gap-2 text-ink-soft">
                        <span className={i.type === "income" ? "text-income" : ""}>{i.name}</span>
                        <span className="figures">{money(i.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
          <Pager page={page} total={list.total} onPage={setPage} />
        </>
      )}
    </section>
  );
}

// ---- 頁面 -------------------------------------------------------------------

export default function AdminApp() {
  const me = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const [section, setSection] = useState<Section>("users");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 使用者清單：使用者分頁顯示、其他分頁拿來篩選；刪除資料後重新載入以更新數量
  const loadUsers = useCallback(() => {
    api<{ data: AdminUser[] }>("/api/admin/users")
      .then((res) => {
        setUsers(res.data);
        setError(null);
      })
      .catch((err) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  if (me === undefined) return <Empty>確認身份中…</Empty>;
  if (me === null) return <LoginPrompt>才能進入後台。</LoginPrompt>;
  if (!isAdmin) return <Empty>只有管理者可以進入後台。</Empty>;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <p className={label}>管理者後台</p>
        <div role="tablist" className="mt-4 flex justify-center gap-6 text-sm tracking-[0.3em]">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              role="tab"
              aria-selected={section === s.key}
              onClick={() => setSection(s.key)}
              className={`border-b pb-1 pl-[0.3em] transition-colors ${
                section === s.key ? "border-seal text-ink" : "border-transparent text-ink-faint hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorLine text={error} />

      {!users ? (
        <Empty>翻閱中…</Empty>
      ) : section === "users" ? (
        <UsersPanel users={users} meId={me._id} onChanged={loadUsers} />
      ) : section === "records" ? (
        <RecordsPanel users={users} onChanged={loadUsers} />
      ) : section === "posts" ? (
        <PostsPanel onChanged={loadUsers} />
      ) : (
        <BudgetsPanel users={users} onChanged={loadUsers} />
      )}
    </div>
  );
}
