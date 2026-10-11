"use client";

import { money } from "./ledger-api";

// 月報與規劃共用的圓餅圖

// 圓餅圖最多 5 個色塊 + 1 塊「其他」；顏色依金額排名依序取用（見 globals.css 的 --viz-*）
const MAX_SLICES = 5;
const SLICE_COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];
export const OTHER_COLOR = "var(--viz-other)";

// count 是選填的「筆數」：月報有（幾筆紀錄），規劃沒有
export type PieEntry = { key: string; label: string; total: number; count?: number };
export type Slice = PieEntry & { color: string; members: string[] };

// entries 要先依金額由大到小排好；第 6 名之後併成「其他（N 類）」
export function buildSlices(entries: PieEntry[], unit = "類"): Slice[] {
  const top = entries.slice(0, MAX_SLICES).map((e, i) => ({ ...e, color: SLICE_COLORS[i], members: [e.key] }));
  const rest = entries.slice(MAX_SLICES);
  if (rest.length === 0) return top;
  const hasCount = rest.every((e) => e.count !== undefined);
  return [
    ...top,
    {
      key: "__other__",
      label: `其他（${rest.length} ${unit}）`,
      total: rest.reduce((s, e) => s + e.total, 0),
      count: hasCount ? rest.reduce((s, e) => s + (e.count ?? 0), 0) : undefined,
      color: OTHER_COLOR,
      members: rest.map((e) => e.key),
    },
  ];
}

export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

const SIZE = 280;
const C = SIZE / 2;
const R = 118;

// 角度以 12 點鐘方向為 0，順時針
const point = (angle: number, radius: number) => [C + radius * Math.sin(angle), C - radius * Math.cos(angle)];

function arcPath(a0: number, a1: number) {
  const [x0, y0] = point(a0, R);
  const [x1, y1] = point(a1, R);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${C} ${C} L${x0} ${y0} A${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
}

// 依序累加每塊的角度：a0 起點、a1 終點、mid 中線
function toArcs(slices: Slice[], total: number) {
  const arcs: (Slice & { a0: number; a1: number; mid: number; share: number })[] = [];
  for (const s of slices) {
    const a0 = arcs.at(-1)?.a1 ?? 0;
    const a1 = a0 + (s.total / total) * Math.PI * 2;
    arcs.push({ ...s, a0, a1, mid: (a0 + a1) / 2, share: s.total / total });
  }
  return arcs;
}

export default function PieChart({
  slices,
  total,
  active,
  onActive,
  ariaLabel,
}: {
  slices: Slice[];
  total: number;
  active: number | null;
  onActive: (i: number | null) => void;
  ariaLabel: string;
}) {
  const arcs = toArcs(slices, total);
  const hovered = active === null ? null : arcs[active];
  const countText = (s: Slice) => (s.count === undefined ? "" : `・${s.count} 筆`);

  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="block w-full overflow-visible" role="list" aria-label={ariaLabel}>
        {arcs.map((a, i) => {
          // 滑過的色塊沿中線往外推一點，其他色塊變淡
          const [dx, dy] = active === i ? point(a.mid, 6).map((v) => v - C) : [0, 0];
          const name = `${a.label}：NT$ ${money(a.total)}，佔 ${percent(a.total, total)}%${a.count === undefined ? "" : `，${a.count} 筆`}`;
          return (
            <g
              key={a.key}
              role="listitem"
              tabIndex={0}
              aria-label={name}
              onMouseEnter={() => onActive(i)}
              onMouseLeave={() => onActive(null)}
              onFocus={() => onActive(i)}
              onBlur={() => onActive(null)}
              className="cursor-default outline-none transition-[opacity,transform] duration-200"
              style={{
                transform: `translate(${dx}px, ${dy}px)`,
                opacity: active === null || active === i ? 1 : 0.4,
              }}
            >
              {a.share >= 0.9999 ? (
                <circle cx={C} cy={C} r={R} fill={a.color} />
              ) : (
                // 2px 紙色描邊 = 色塊之間的間隙
                <path d={arcPath(a.a0, a.a1)} fill={a.color} stroke="var(--paper-raised)" strokeWidth={2} strokeLinejoin="round" />
              )}
              {/* 夠大的色塊才直接標百分比，小的交給提示框與表格 */}
              {a.share >= 0.08 && (
                <text
                  x={point(a.mid, R * 0.64)[0]}
                  y={point(a.mid, R * 0.64)[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--viz-on)"
                  className="figures pointer-events-none"
                  fontSize={14}
                  fontWeight={600}
                >
                  {Math.round(a.share * 100)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 提示框：數值在前、分類在後 */}
      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 w-max -translate-x-1/2 -translate-y-[calc(100%+10px)] border border-rule bg-paper-raised px-3 py-2 text-left shadow-[0_6px_18px_-8px_rgba(60,40,20,0.4)]"
          style={{
            left: `${(point(hovered.mid, R * 0.7)[0] / SIZE) * 100}%`,
            top: `${(point(hovered.mid, R * 0.7)[1] / SIZE) * 100}%`,
          }}
        >
          <p className="figures text-base font-semibold text-ink">NT$ {money(hovered.total)}</p>
          <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
            <span className="inline-block h-0.5 w-3" style={{ background: hovered.color }} />
            {hovered.label}・{percent(hovered.total, total)}%{countText(hovered)}
          </p>
        </div>
      )}
    </div>
  );
}
