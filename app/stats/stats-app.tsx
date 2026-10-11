"use client";

import { useEffect, useState } from "react";
import { LoginPrompt, useCurrentUser } from "../current-user";
import {
  api,
  cnYear,
  CN_MONTHS,
  errorText,
  label,
  money,
  shiftMonth,
  textButton,
  today,
} from "../ledger-api";
import PieChart, { buildSlices, OTHER_COLOR, percent } from "../pie-chart";

type CategoryStat = { category: string; total: number; count: number };
type MonthlyStats = {
  month: string;
  total: number;
  count: number;
  previousTotal: number;
  categories: CategoryStat[];
};

// ---- 頁面 ------------------------------------------------------------------

export default function StatsApp() {
  const me = useCurrentUser();
  const userId = me?._id ?? "";
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  // GET /api/stats/monthly：重新載入時保留舊畫面（變淡），不閃爍
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api<MonthlyStats>(`/api/stats/monthly?month=${month}`);
        if (!cancelled) {
          setStats(res);
          setError(null);
          setActive(null);
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

  const [year, monthNum] = month.split("-");
  const slices = stats
    ? buildSlices(stats.categories.map((c) => ({ key: c.category, label: c.category, total: c.total, count: c.count })))
    : [];
  const sliceIndexOf = (category: string) => slices.findIndex((s) => s.members.includes(category));
  const top = stats?.categories[0];
  const delta = stats && stats.previousTotal > 0 ? (stats.total - stats.previousTotal) / stats.previousTotal : null;

  if (me === undefined) return <p className="py-10 text-center text-sm italic text-ink-faint">翻開月報中…</p>;
  if (me === null) return <LoginPrompt>再來看月報。</LoginPrompt>;

  return (
    <div className="space-y-12">
      {/* 月份：下方所有數字都依此計算 */}
      <section className="space-y-6 text-center">
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setMonth(shiftMonth(month, -1))} className={textButton} aria-label="上個月">
            ← 前月
          </button>
          <h2 className="min-w-44">
            <span className="block text-xs tracking-[0.4em] text-ink-faint">{cnYear(year)}</span>
            <span className="text-2xl tracking-[0.3em]">{CN_MONTHS[Number(monthNum) - 1]}月支出</span>
          </h2>
          <button onClick={() => setMonth(shiftMonth(month, 1))} className={textButton} aria-label="下個月">
            次月 →
          </button>
        </div>
      </section>

      {error && <p className="text-center text-sm italic text-expense">※ {error}</p>}

      {!stats ? (
        <p className="py-10 text-center text-sm italic text-ink-faint">清點帳本中…</p>
      ) : (
        <div className={`space-y-12 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* 本月總支出 */}
          <section className="text-center">
            <p className={label}>本月總支出</p>
            <p className="figures mt-2 text-5xl sm:text-6xl">
              <span className="mr-1 align-top text-xl text-ink-faint">NT$</span>
              {money(stats.total)}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              共 <span className="figures">{stats.count}</span> 筆
              <span className="mx-2 text-ink-faint">・</span>
              {delta === null ? (
                <span className="italic">上個月沒有支出可比較</span>
              ) : (
                <span>
                  比上月
                  <span className="figures mx-1">
                    {delta === 0 ? "持平" : `${delta > 0 ? "↑" : "↓"} ${Math.abs(Math.round(delta * 100))}%`}
                  </span>
                  <span className="text-ink-faint">（上月 NT$ {money(stats.previousTotal)}）</span>
                </span>
              )}
            </p>
            {top && stats.total > 0 && (
              <p className="mt-2 text-sm italic text-ink-soft">
                最大宗是「{top.category}」，佔了 {percent(top.total, stats.total)}%。
              </p>
            )}
          </section>

          {stats.total === 0 ? (
            <p className="py-6 text-center text-sm italic text-ink-faint">這個月沒有任何支出紀錄。</p>
          ) : (
            <section className="relative border border-rule bg-paper-raised px-5 py-8 shadow-[0_1px_0_var(--rule),0_12px_30px_-18px_rgba(60,45,30,0.35)] sm:px-8">
              <span aria-hidden className="washi -left-7 -top-2 -rotate-[28deg]" />
              <span aria-hidden className="washi -right-7 -top-2 rotate-[24deg]" />
              <h3 className="mb-8 text-center text-lg tracking-[0.2em]">分類統計</h3>

              <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <PieChart
                  slices={slices}
                  total={stats.total}
                  active={active}
                  onActive={setActive}
                  ariaLabel="本月支出分類圓餅圖"
                />

                {/* 分類小計表：同時是圓餅圖的圖例，色塊與圖上一致 */}
                <table className="w-full text-sm">
                  <caption className="sr-only">本月各分類支出小計</caption>
                  <thead>
                    <tr className="border-b border-ink/40 text-left">
                      <th scope="col" className={`${label} pb-2 font-normal`}>
                        分類
                      </th>
                      <th scope="col" className={`${label} pb-2 text-right font-normal`}>
                        筆數
                      </th>
                      <th scope="col" className={`${label} pb-2 text-right font-normal`}>
                        小計
                      </th>
                      <th scope="col" className={`${label} pb-2 text-right font-normal`}>
                        佔比
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.categories.map((c) => {
                      const si = sliceIndexOf(c.category);
                      const color = slices[si]?.color ?? OTHER_COLOR;
                      return (
                        <tr
                          key={c.category}
                          onMouseEnter={() => setActive(si)}
                          onMouseLeave={() => setActive(null)}
                          className={`border-b border-rule transition-colors ${
                            active === si ? "bg-ink/[0.05]" : ""
                          }`}
                        >
                          <th scope="row" className="py-2.5 text-left font-normal">
                            <span className="flex items-center gap-2.5">
                              <span aria-hidden className="inline-block h-3 w-3 rounded-[2px]" style={{ background: color }} />
                              <span className="tracking-wider">{c.category}</span>
                            </span>
                          </th>
                          <td className="figures py-2.5 text-right text-ink-soft">{c.count}</td>
                          <td className="figures py-2.5 text-right">{money(c.total)}</td>
                          <td className="figures py-2.5 text-right text-ink-soft">{percent(c.total, stats.total)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-double border-ink/60">
                      <th scope="row" className="pt-3 text-left font-normal tracking-[0.3em]">
                        合計
                      </th>
                      <td className="figures pt-3 text-right text-ink-soft">{stats.count}</td>
                      <td className="figures pt-3 text-right font-semibold">{money(stats.total)}</td>
                      <td className="figures pt-3 text-right text-ink-soft">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
