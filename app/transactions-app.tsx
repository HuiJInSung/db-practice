"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  cnYear,
  CN_MONTHS,
  errorText,
  label,
  lineInput,
  money,
  shiftMonth,
  textButton,
  toDay,
  today,
} from "./ledger-api";
import { LoginPrompt, useCurrentUser } from "./current-user";

type TxType = "income" | "expense";
type Transaction = {
  _id: string;
  type: TxType;
  amount: number;
  category: string;
  note?: string;
  date: string;
};
type ListResponse = {
  data: Transaction[];
  page: number;
  limit: number;
  total: number;
  summary: { income: number; expense: number };
};

const PAGE_SIZE = 10;
const CATEGORIES: Record<TxType, string[]> = {
  expense: ["餐飲", "交通", "購物", "房租", "娛樂", "醫療", "教育"],
  income: ["薪水", "接案", "零用錢", "家教", "投資"],
};
const TYPE_LABEL: Record<TxType, string> = { expense: "支出", income: "收入" };

// 日期都以台灣時間顯示與輸入
const weekdayFormatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", weekday: "short" });
const fromDay = (day: string) => `${day}T12:00:00+08:00`;

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

// 把已依日期排序的紀錄按「天」分組
function groupByDay(items: Transaction[]) {
  const groups: { day: string; items: Transaction[] }[] = [];
  for (const t of items) {
    const day = toDay(t.date);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(t);
    else groups.push({ day, items: [t] });
  }
  return groups;
}

type FormState = { type: TxType; amount: string; category: string; note: string; date: string };
const emptyForm = (): FormState => ({ type: "expense", amount: "", category: "", note: "", date: today() });

export default function TransactionsApp() {
  const me = useCurrentUser();
  const userId = me?._id ?? "";
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [typeFilter, setTypeFilter] = useState<"" | TxType>("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // GET /api/transactions：依條件載入列表（登入的使用者換人時也重新載入）
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { from, to } = monthRange(month);
    const params = new URLSearchParams({ from, to, page: String(page), limit: String(PAGE_SIZE) });
    if (typeFilter) params.set("type", typeFilter);

    (async () => {
      setLoading(true);
      try {
        const res = await api<ListResponse>(`/api/transactions?${params}`);
        if (!cancelled) setList(res);
      } catch (err) {
        if (!cancelled) setMessage({ kind: "error", text: errorText(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, month, typeFilter, page, reloadKey]);

  function changeMonth(next: string) {
    setMonth(next);
    setPage(1);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  // POST（新增）或 PATCH（修改）
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = {
      type: form.type,
      amount: form.amount === "" ? undefined : Number(form.amount),
      category: form.category,
      note: form.note,
      date: fromDay(form.date),
    };
    try {
      if (editingId) {
        await api(`/api/transactions/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage({ kind: "ok", text: "已修訂這一筆。" });
      } else {
        await api("/api/transactions", { method: "POST", body: JSON.stringify(payload) });
        setMessage({ kind: "ok", text: "記下了。" });
        // 新增的紀錄不在目前篩選的月份時，切換過去才看得到
        if (form.date.slice(0, 7) !== month) setMonth(form.date.slice(0, 7));
        setPage(1);
      }
      cancelEdit();
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    } finally {
      setSaving(false);
    }
  }

  // GET /api/transactions/:id：取得最新資料後放進表單編輯
  async function startEdit(id: string) {
    setMessage(null);
    setConfirmDeleteId(null);
    try {
      const { data } = await api<{ data: Transaction }>(`/api/transactions/${id}`);
      setEditingId(data._id);
      setForm({
        type: data.type,
        amount: String(data.amount),
        category: data.category,
        note: data.note ?? "",
        date: toDay(data.date),
      });
      document.getElementById("entry")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
      setReloadKey((k) => k + 1);
    }
  }

  // DELETE /api/transactions/:id
  async function remove(id: string) {
    setMessage(null);
    try {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      if (editingId === id) cancelEdit();
      setConfirmDeleteId(null);
      setMessage({ kind: "ok", text: "已從帳本劃去。" });
      // 刪掉本頁最後一筆時回到上一頁
      if (list && list.data.length === 1 && page > 1) setPage(page - 1);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setMessage({ kind: "error", text: errorText(err) });
    }
  }

  const [year, monthNum] = month.split("-");
  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.limit)) : 1;
  const income = list?.summary.income ?? 0;
  const expense = list?.summary.expense ?? 0;
  const balance = income - expense;
  const spentRatio = income > 0 ? Math.min(1, expense / income) : expense > 0 ? 1 : 0;

  if (me === undefined) return <p className="py-10 text-center text-sm italic text-ink-faint">翻開帳本中…</p>;
  if (me === null) return <LoginPrompt>帳本就會打開。</LoginPrompt>;

  return (
    <div className="space-y-14">
      {/* 月份與本月總結 */}
      <section className="text-center">
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => changeMonth(shiftMonth(month, -1))} className={textButton} aria-label="上個月">
            ← 前月
          </button>
          <h2 className="min-w-44">
            <span className="block text-xs tracking-[0.4em] text-ink-faint">{cnYear(year)}</span>
            <span className="text-2xl tracking-[0.3em]">{CN_MONTHS[Number(monthNum) - 1]}月</span>
          </h2>
          <button onClick={() => changeMonth(shiftMonth(month, 1))} className={textButton} aria-label="下個月">
            次月 →
          </button>
        </div>

        <div className="mt-8">
          <p className={label}>本月結餘</p>
          <p
            className={`figures mt-2 text-5xl font-normal sm:text-6xl ${
              balance < 0 ? "text-expense" : "text-ink"
            } ${loading ? "opacity-50" : ""} transition-opacity`}
          >
            <span className="mr-1 align-top text-xl text-ink-faint">NT$</span>
            {balance < 0 && "−"}
            {money(Math.abs(balance))}
          </p>
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-2 divide-x divide-rule text-sm">
            <div>
              <p className={label}>收入</p>
              <p className="figures mt-1 text-xl text-income">{money(income)}</p>
            </div>
            <div>
              <p className={label}>支出</p>
              <p className="figures mt-1 text-xl text-expense">{money(expense)}</p>
            </div>
          </div>
          {/* 支出佔收入的比例 */}
          <div className="mx-auto mt-6 max-w-sm">
            <div className="h-px w-full bg-rule">
              <div
                className="h-px bg-expense transition-[width] duration-500"
                style={{ width: `${spentRatio * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs italic text-ink-faint">
              {income > 0
                ? `花去收入的 ${Math.round((expense / income) * 100)}%`
                : expense > 0
                  ? "這個月還沒有收入"
                  : "這個月還是空白的一頁"}
            </p>
          </div>
        </div>
      </section>

      {/* 記一筆 / 修訂 */}
      <form
        id="entry"
        onSubmit={submit}
        className={`relative scroll-mt-8 border bg-paper-raised/70 px-6 py-7 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8 ${
          editingId ? "border-accent" : "border-rule"
        }`}
      >
        {/* 紙膠帶貼住卡片兩角 */}
        <span aria-hidden className="washi -left-7 -top-2 -rotate-[28deg]" />
        <span aria-hidden className="washi -right-7 -top-2 rotate-[24deg]" />
        <div className="mb-6 flex items-baseline justify-between">
          <h3 className="text-lg tracking-[0.2em]">{editingId ? "修訂一筆" : "記一筆"}</h3>
          <div className="flex gap-4 text-sm" role="radiogroup" aria-label="類型">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={form.type === t}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    type: t,
                    category: CATEGORIES[t].includes(f.category) ? f.category : "",
                  }))
                }
                className={`border-b pb-0.5 tracking-widest transition-colors ${
                  form.type === t
                    ? t === "expense"
                      ? "border-expense text-expense"
                      : "border-income text-income"
                    : "border-transparent text-ink-faint hover:text-ink-soft"
                }`}
              >
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-[1.2fr_1fr_1fr]">
          <label className="block">
            <span className={label}>金額</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className={`${lineInput} figures text-2xl`}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className={label}>分類</span>
            {/* 手機瀏覽器不支援 datalist 下拉，改用原生 select */}
            <select
              required
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={`${lineInput} mt-1.5 ${form.category ? "" : "text-ink-faint"}`}
            >
              <option value="" disabled>
                選擇分類
              </option>
              {/* 舊紀錄的分類若不在清單內，仍保留可選 */}
              {form.category && !CATEGORIES[form.type].includes(form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
              {CATEGORIES[form.type].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={label}>日期</span>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={`${lineInput} figures mt-1.5`}
            />
          </label>
        </div>

        <label className="mt-6 block">
          <span className={label}>備註</span>
          <input
            maxLength={200}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className={`${lineInput} italic`}
            placeholder="寫點什麼，關於這一筆…"
          />
        </label>

        <div className="mt-8 flex items-center justify-end gap-5">
          {editingId && (
            <button type="button" onClick={cancelEdit} className={textButton}>
              放棄修訂
            </button>
          )}
          <button
            type="submit"
            disabled={saving || !userId}
            className="rounded-full bg-ink px-7 py-2.5 text-sm tracking-[0.3em] text-paper transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            {saving ? "書寫中…" : editingId ? "存　檔" : "記　下"}
          </button>
        </div>
      </form>

      {message && (
        <p
          role="status"
          className={`-mt-8 text-center text-sm italic ${
            message.kind === "ok" ? "text-income" : "text-expense"
          }`}
        >
          {message.kind === "ok" ? "✓ " : "※ "}
          {message.text}
        </p>
      )}

      {/* 明細 */}
      <section>
        <div className="mb-6 flex items-baseline justify-between border-b border-ink pb-2">
          <h3 className="text-lg tracking-[0.2em]">明細</h3>
          <div className="flex gap-4 text-sm" role="radiogroup" aria-label="篩選類型">
            {(
              [
                ["", "全部"],
                ["expense", "支出"],
                ["income", "收入"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                role="radio"
                aria-checked={typeFilter === value}
                onClick={() => {
                  setTypeFilter(value);
                  setPage(1);
                }}
                className={`tracking-widest transition-colors ${
                  typeFilter === value ? "text-ink" : "text-ink-faint hover:text-ink-soft"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {!list ? (
          <p className="py-10 text-center text-sm italic text-ink-faint">翻閱中…</p>
        ) : list.data.length === 0 ? (
          <p className="py-10 text-center text-sm italic text-ink-faint">這一頁，還沒有字跡。</p>
        ) : (
          <div className={`space-y-8 transition-opacity ${loading ? "opacity-50" : ""}`}>
            {groupByDay(list.data).map(({ day, items }) => (
              <div key={day} className="grid grid-cols-[3.5rem_1fr] gap-4">
                {/* 日期戳記 */}
                <div className="pt-0.5 text-center">
                  <p className="figures text-2xl leading-none">{day.slice(8)}</p>
                  <p className="mt-1 text-[0.7rem] tracking-widest text-ink-faint">
                    {weekdayFormatter.format(new Date(fromDay(day)))}
                  </p>
                </div>
                <ul className="space-y-3">
                  {items.map((t) => (
                    <li
                      key={t._id}
                      className={`group -mx-2 px-2 py-1 ${editingId === t._id ? "bg-accent/10" : ""}`}
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="shrink-0 tracking-wider">{t.category}</span>
                        {t.note && (
                          <span className="min-w-0 truncate text-sm italic text-ink-soft">{t.note}</span>
                        )}
                        <span className="leader" aria-hidden />
                        <span
                          className={`figures shrink-0 text-lg ${
                            t.type === "income" ? "text-income" : "text-expense"
                          }`}
                        >
                          {t.type === "income" ? "+" : "−"}
                          {money(t.amount)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-end gap-4 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        {confirmDeleteId === t._id ? (
                          <>
                            <span className="text-xs italic text-ink-faint">確定要劃去嗎？</span>
                            <button onClick={() => remove(t._id)} className={`${textButton} text-expense hover:text-expense`}>
                              劃去
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)} className={textButton}>
                              留著
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(t._id)} className={textButton}>
                              修訂
                            </button>
                            <button onClick={() => setConfirmDeleteId(t._id)} className={textButton}>
                              刪除
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {list && list.total > 0 && (
          <div className="mt-10 flex items-center justify-between border-t border-rule pt-4">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className={textButton}>
              ← 前頁
            </button>
            <span className="figures text-sm text-ink-faint">
              {list.total} 筆・第 {page} / {totalPages} 頁
            </span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className={textButton}>
              次頁 →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
