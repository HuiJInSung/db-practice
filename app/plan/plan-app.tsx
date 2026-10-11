"use client";

import { useEffect, useState } from "react";
import { LoginPrompt, useCurrentUser } from "../current-user";
import PieChart, { OTHER_COLOR, percent, type Slice } from "../pie-chart";
import {
  api,
  cnYear,
  CN_MONTHS,
  errorText,
  inkButton,
  label,
  lineInput,
  money,
  shiftMonth,
  textButton,
  today,
} from "../ledger-api";

type Kind = "income" | "expense";
type Item = { type: Kind; name: string; amount: number };
type Plan = { month: string; items: Item[]; saved: boolean; copiedFrom: string | null };

// 畫面上的項目多一個 key，讓 React 在新增/刪除時不會搞混輸入框
type Row = Item & { key: number };
let nextKey = 0;
const toRows = (items: Item[]): Row[] => items.map((i) => ({ type: i.type, name: i.name, amount: i.amount, key: nextKey++ }));

const KINDS = {
  income: { title: "收入", en: "Income", color: "text-income", placeholder: "例如：獎金" },
  expense: { title: "費用", en: "Expenses", color: "text-expense", placeholder: "例如：保險費" },
} as const;

const monthName = (month: string) => `${CN_MONTHS[Number(month.split("-")[1]) - 1]}月`;

// 收入或費用的一區：每列可改名稱與金額、可刪除，最下面一列新增項目
function Section({
  kind,
  rows,
  onChange,
  onRemove,
  onAdd,
}: {
  kind: Kind;
  rows: Row[];
  onChange: (key: number, patch: Partial<Item>) => void;
  onRemove: (key: number) => void;
  onAdd: (name: string, amount: number) => string | null;
}) {
  const k = KINDS[kind];
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  function add(e: React.FormEvent) {
    e.preventDefault();
    const err = onAdd(name.trim(), Number(amount) || 0);
    setAddError(err);
    if (!err) {
      setName("");
      setAmount("");
    }
  }

  return (
    <section className="relative border border-rule bg-paper-raised px-5 py-7 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8">
      <h3 className="mb-5 flex items-baseline justify-between">
        <span className="text-lg tracking-[0.3em]">
          {k.title}
          <span className="ml-2 text-[0.6rem] uppercase italic tracking-[0.3em] text-ink-faint">{k.en}</span>
        </span>
        <span className={`figures text-xl ${k.color}`}>{money(total)}</span>
      </h3>

      <ul>
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-3 border-b border-rule">
            <input
              aria-label={`${k.title}項目名稱`}
              value={r.name}
              onChange={(e) => onChange(r.key, { name: e.target.value })}
              maxLength={30}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 tracking-wider text-ink outline-none focus:bg-ink/[0.04]"
            />
            <span className="text-xs text-ink-faint">NT$</span>
            <input
              aria-label={`${r.name || k.title}金額`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={r.amount === 0 ? "" : r.amount}
              placeholder="0"
              onChange={(e) => onChange(r.key, { amount: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
              className="figures w-28 border-0 bg-transparent py-2.5 text-right text-ink outline-none placeholder:text-ink-faint/60 focus:bg-ink/[0.04]"
            />
            <button
              type="button"
              onClick={() => onRemove(r.key)}
              aria-label={`刪除 ${r.name || "這個項目"}`}
              className={`${textButton} px-1 hover:text-expense`}
            >
              ✕
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-sm italic text-ink-faint">還沒有任何{k.title}項目。</li>}
      </ul>

      {/* lineInput 自帶 w-full，寬度交給外層的 div 決定，避免和 w-24 之類的寬度互相蓋掉 */}
      <form onSubmit={add} className="mt-5 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <input
            aria-label={`新增${k.title}項目名稱`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`新增${k.title}項目，${k.placeholder}`}
            maxLength={30}
            className={`${lineInput} text-sm`}
          />
        </div>
        <div className="w-24 shrink-0">
          <input
            aria-label={`新增${k.title}金額`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額"
            className={`${lineInput} figures text-right text-sm`}
          />
        </div>
        <button type="submit" disabled={!name.trim()} className={`${textButton} shrink-0 whitespace-nowrap pb-2`}>
          ＋ 新增
        </button>
      </form>
      {addError && <p className="mt-2 text-xs italic text-expense">※ {addError}</p>}
    </section>
  );
}

// 每個費用項目依它在清單中的位置固定一個顏色（globals.css 的 --item-*），改金額不會換色；
// 第 15 項之後沒有專屬顏色，合併成最後一塊「其他」
const ITEM_COLORS = 14;

// 圓餅依清單順序畫（不依金額排序），每塊旁邊永遠是同樣的鄰居，顏色才能保證和相鄰色塊分得開
function buildItemSlices(rows: Row[]): Slice[] {
  const slices: Slice[] = [];
  rows.forEach((r, i) => {
    if (r.amount <= 0) return;
    const entry = { key: String(r.key), label: r.name.trim() || "（未命名）", total: r.amount };
    if (i < ITEM_COLORS) {
      slices.push({ ...entry, color: `var(--item-${i + 1})`, members: [entry.key] });
      return;
    }
    const other = slices.find((s) => s.key === "__other__");
    if (other) {
      other.total += entry.total;
      other.members.push(entry.key);
      other.label = `其他（${other.members.length} 項）`;
    } else {
      slices.push({ key: "__other__", label: "其他（1 項）", total: entry.total, color: OTHER_COLOR, members: [entry.key] });
    }
  });
  return slices;
}

// 費用分配圓餅圖：只畫金額大於 0 的費用項目，旁邊的表格同時是圖例（順序與清單、圓餅一致）
function ExpensePie({ rows, incomeTotal }: { rows: Row[]; incomeTotal: number }) {
  const [active, setActive] = useState<number | null>(null);
  const slices = buildItemSlices(rows);
  const entries = rows
    .filter((r) => r.amount > 0)
    .map((r) => ({ key: String(r.key), label: r.name.trim() || "（未命名）", total: r.amount }));
  const total = entries.reduce((s, e) => s + e.total, 0);
  const sliceIndexOf = (key: string) => slices.findIndex((s) => s.members.includes(key));

  return (
    <section className="relative border border-rule bg-paper-raised px-5 py-8 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8">
      <span aria-hidden className="washi -left-7 -top-2 -rotate-[28deg]" />
      <span aria-hidden className="washi -right-7 -top-2 rotate-[24deg]" />
      <h3 className="mb-8 text-center text-lg tracking-[0.2em]">費用分配</h3>

      {total === 0 ? (
        <p className="py-4 text-center text-sm italic text-ink-faint">填入費用金額後，這裡會畫出圓餅圖。</p>
      ) : (
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <PieChart slices={slices} total={total} active={active} onActive={setActive} ariaLabel="本月費用分配圓餅圖" />

          <table className="w-full text-sm">
            <caption className="sr-only">本月各項費用與佔比</caption>
            <thead>
              <tr className="border-b border-ink/40 text-left">
                <th scope="col" className={`${label} pb-2 font-normal`}>
                  項目
                </th>
                <th scope="col" className={`${label} pb-2 text-right font-normal`}>
                  金額
                </th>
                <th scope="col" className={`${label} pb-2 text-right font-normal`}>
                  佔比
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const si = sliceIndexOf(e.key);
                return (
                  <tr
                    key={e.key}
                    onMouseEnter={() => setActive(si)}
                    onMouseLeave={() => setActive(null)}
                    className={`border-b border-rule transition-colors ${active === si ? "bg-ink/[0.05]" : ""}`}
                  >
                    <th scope="row" className="py-2 text-left font-normal">
                      <span className="flex items-center gap-2.5">
                        <span
                          aria-hidden
                          className="inline-block h-3 w-3 shrink-0 rounded-[2px]"
                          style={{ background: slices[si]?.color ?? OTHER_COLOR }}
                        />
                        <span className="tracking-wider">{e.label}</span>
                      </span>
                    </th>
                    <td className="figures py-2 text-right">{money(e.total)}</td>
                    <td className="figures py-2 text-right text-ink-soft">{percent(e.total, total)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-double border-ink/60">
                <th scope="row" className="pt-3 text-left font-normal tracking-[0.3em]">
                  合計
                </th>
                <td className="figures pt-3 text-right font-semibold">{money(total)}</td>
                <td className="figures pt-3 text-right text-ink-soft">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {total > 0 && incomeTotal > 0 && (
        <p className="mt-6 text-center text-sm italic text-ink-soft">
          費用佔收入 {percent(total, incomeTotal)}%
          {total > incomeTotal ? "，已經超出收入了。" : `，還留下 NT$ ${money(incomeTotal - total)}。`}
        </p>
      )}
    </section>
  );
}

export default function PlanApp() {
  const me = useCurrentUser();
  const userId = me?._id ?? "";
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // GET /api/budgets/:month
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<Plan>(`/api/budgets/${month}`);
        if (!cancelled) {
          setPlan(res);
          setRows(toRows(res.items));
          setDirty(false);
          setError(null);
          setNotice(null);
        }
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, month]);

  // 有未儲存的修改時，關閉或重新整理頁面前提醒
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const confirmLeave = () => !dirty || window.confirm("這個月的規劃還沒儲存，確定要離開嗎？");

  function goMonth(delta: number) {
    if (confirmLeave()) setMonth(shiftMonth(month, delta));
  }

  function edit(next: Row[]) {
    setRows(next);
    setDirty(true);
    setNotice(null);
  }

  const change = (key: number, patch: Partial<Item>) => edit(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: number) => edit(rows.filter((r) => r.key !== key));
  const add = (type: Kind) => (name: string, amount: number) => {
    if (!name) return "請填寫項目名稱";
    if (rows.some((r) => r.type === type && r.name.trim() === name)) return `已經有「${name}」這個項目了`;
    edit([...rows, { type, name, amount, key: nextKey++ }]);
    return null;
  };

  async function save() {
    if (rows.some((r) => !r.name.trim())) {
      setError("有項目沒有填名稱");
      return;
    }
    setSaving(true);
    try {
      const res = await api<Plan>(`/api/budgets/${month}`, {
        method: "PUT",
        body: JSON.stringify({ items: rows.map(({ type, name, amount }) => ({ type, name, amount })) }),
      });
      setPlan(res);
      setRows(toRows(res.items));
      setDirty(false);
      setError(null);
      setNotice(`${monthName(month)}的規劃已儲存。`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  const [year, monthNum] = month.split("-");
  const income = rows.filter((r) => r.type === "income");
  const expense = rows.filter((r) => r.type === "expense");
  const incomeTotal = income.reduce((s, r) => s + r.amount, 0);
  const expenseTotal = expense.reduce((s, r) => s + r.amount, 0);
  const balance = incomeTotal - expenseTotal;

  if (me === undefined) return <p className="py-10 text-center text-sm italic text-ink-faint">翻開規劃中…</p>;
  if (me === null) return <LoginPrompt>再來做每月規劃。</LoginPrompt>;

  return (
    <div className="space-y-10">
      {/* 月份 */}
      <section className="space-y-6 text-center">
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => goMonth(-1)} className={textButton} aria-label="上個月">
            ← 前月
          </button>
          <h2 className="min-w-44">
            <span className="block text-xs tracking-[0.4em] text-ink-faint">{cnYear(year)}</span>
            <span className="text-2xl tracking-[0.3em]">{CN_MONTHS[Number(monthNum) - 1]}月規劃</span>
          </h2>
          <button onClick={() => goMonth(1)} className={textButton} aria-label="下個月">
            次月 →
          </button>
        </div>
      </section>

      {error && <p className="text-center text-sm italic text-expense">※ {error}</p>}

      {!plan ? (
        <p className="py-10 text-center text-sm italic text-ink-faint">翻開規劃中…</p>
      ) : (
        <div className={`space-y-10 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* 結餘 = 收入 − 費用 */}
          <section className="text-center">
            <p className={label}>預計結餘</p>
            <p className={`figures mt-2 text-5xl sm:text-6xl ${balance < 0 ? "text-expense" : "text-ink"}`}>
              <span className="mr-1 align-top text-xl text-ink-faint">NT$</span>
              {balance < 0 && "−"}
              {money(Math.abs(balance))}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              收入 <span className="figures text-income">{money(incomeTotal)}</span>
              <span className="mx-2 text-ink-faint">−</span>
              費用 <span className="figures text-expense">{money(expenseTotal)}</span>
              {incomeTotal > 0 && (
                <>
                  <span className="mx-2 text-ink-faint">・</span>
                  費用佔收入 <span className="figures">{Math.round((expenseTotal / incomeTotal) * 100)}%</span>
                </>
              )}
            </p>
            {!plan.saved && (
              <p className="mt-2 text-sm italic text-ink-faint">
                {plan.copiedFrom
                  ? `這個月還沒規劃，先帶入${monthName(plan.copiedFrom)}的項目與金額。`
                  : "這是第一次規劃，先帶入預設項目，填好金額後記得儲存。"}
              </p>
            )}
          </section>

          <Section kind="income" rows={income} onChange={change} onRemove={remove} onAdd={add("income")} />
          <Section kind="expense" rows={expense} onChange={change} onRemove={remove} onAdd={add("expense")} />
          <ExpensePie rows={expense} incomeTotal={incomeTotal} />

          <div className="flex flex-col items-center gap-3">
            <button onClick={save} disabled={saving || (!dirty && plan.saved)} className={inkButton}>
              {saving ? "儲存中…" : "儲存規劃"}
            </button>
            {dirty && <p className="text-xs italic text-ink-faint">有尚未儲存的修改</p>}
            {notice && (
              <p role="status" className="text-sm italic text-income">
                {notice}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
