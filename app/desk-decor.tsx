// 兩側留白的裝飾插畫：跟記帳、理財有關的小物，搭配植物。
// 全部是細線條的 SVG，只在寬螢幕顯示，純裝飾（aria-hidden），不影響閱讀與操作。

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;
const tint = { fill: "currentColor", fillOpacity: 0.1 } as const;

// 錢幣草（Pilea）盆栽：圓圓的葉子像一枚枚硬幣，盆上寫「招財」
function MoneyPlant() {
  const leaves: [number, number, number][] = [
    [100, 38, 21],
    [58, 66, 17],
    [144, 60, 18],
    [42, 112, 13],
    [158, 108, 14],
    [98, 92, 15],
    [74, 132, 10],
    [128, 136, 10],
  ];
  return (
    <svg viewBox="0 0 200 240" overflow="visible" {...line}>
      {leaves.map(([x, y]) => (
        <path key={`s${x}`} d={`M100 162 Q ${(100 + x) / 2} ${y + 40}, ${x} ${y}`} strokeOpacity={0.7} />
      ))}
      {leaves.map(([x, y, r]) => (
        <g key={`l${x}`}>
          <circle cx={x} cy={y} r={r} {...tint} stroke="currentColor" />
          <circle cx={x} cy={y} r={1.4} fill="currentColor" stroke="none" />
          {/* 葉脈 */}
          <path d={`M${x} ${y} L${x - r * 0.6} ${y - r * 0.55} M${x} ${y} L${x + r * 0.6} ${y - r * 0.55} M${x} ${y} L${x} ${y + r * 0.75}`} strokeOpacity={0.4} />
        </g>
      ))}
      {/* 花盆 */}
      <rect x="52" y="160" width="96" height="14" rx="3" {...tint} stroke="currentColor" />
      <path d="M60 174 L140 174 L131 232 L69 232 Z" {...tint} stroke="currentColor" />
      <text x="100" y="208" textAnchor="middle" fontSize="15" letterSpacing="4" fill="currentColor" stroke="none">
        招財
      </text>
    </svg>
  );
}

// 算盤：上一下四，撥出一個數字的樣子
function Abacus() {
  // 每一檔：上珠是否撥下（靠梁），下珠撥上幾顆
  const rods: [boolean, number][] = [
    [false, 1],
    [true, 3],
    [false, 0],
    [true, 0],
    [false, 4],
    [false, 2],
    [true, 1],
  ];
  return (
    <svg viewBox="0 0 220 150" overflow="visible" {...line}>
      <rect x="6" y="6" width="208" height="138" rx="7" {...tint} stroke="currentColor" />
      <rect x="16" y="16" width="188" height="118" rx="2" />
      <path d="M16 54 H204 M16 58 H204" />
      {rods.map(([upperDown, lowerUp], i) => {
        const x = 34 + i * 25.5;
        const lower = [0, 1, 2, 3].map((k) => (k < lowerUp ? 68 + k * 12 : 86 + k * 12));
        return (
          <g key={x}>
            <path d={`M${x} 16 V134`} strokeOpacity={0.6} />
            <ellipse cx={x} cy={upperDown ? 46 : 26} rx={9} ry={4.6} {...tint} fillOpacity={0.22} stroke="currentColor" />
            {lower.map((y, k) => (
              <ellipse key={k} cx={x} cy={y} rx={9} ry={4.6} {...tint} fillOpacity={0.22} stroke="currentColor" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// 收據：上面有幾筆品項與合計，底部是撕開的鋸齒邊
function Receipt() {
  const teeth = Array.from({ length: 12 }, (_, i) => {
    const x = 130 - (i + 1) * 10;
    return `L${x + 5} ${i % 2 ? 214 : 222} L${x} 214`;
  }).join(" ");
  const items: [string, string][] = [
    ["早餐", "65"],
    ["公車", "15"],
    ["書", "380"],
    ["咖啡", "120"],
  ];
  return (
    <svg viewBox="0 0 140 230" overflow="visible" {...line}>
      <path d={`M10 8 H130 V214 ${teeth} L10 214 Z`} {...tint} fillOpacity={0.06} stroke="currentColor" />
      <g fill="currentColor" stroke="none" fontSize="10">
        <text x="70" y="30" textAnchor="middle" fontSize="11" letterSpacing="3">
          收　據
        </text>
        <text x="70" y="44" textAnchor="middle" fontSize="7" letterSpacing="1.5" fillOpacity={0.7}>
          2026 · 10 · 10
        </text>
        {items.map(([name, price], i) => (
          <g key={name}>
            <text x="20" y={74 + i * 20}>
              {name}
            </text>
            <text x="120" y={74 + i * 20} textAnchor="end">
              {price}
            </text>
          </g>
        ))}
        <text x="20" y="176" fontSize="11">
          合計
        </text>
        <text x="120" y="176" textAnchor="end" fontSize="12">
          580
        </text>
      </g>
      <path d="M18 54 H122 M18 158 H122" strokeDasharray="3 3" strokeOpacity={0.6} />
      {[0, 1, 2, 3].map((i) => (
        <path key={i} d={`M${46 + (i === 2 ? -12 : 0)} ${71 + i * 20} H${96}`} strokeDasharray="1 3" strokeOpacity={0.5} />
      ))}
      <path d="M18 190 H122" strokeOpacity={0.6} />
      <text x="70" y="204" textAnchor="middle" fontSize="7" letterSpacing="2" fill="currentColor" stroke="none" fillOpacity={0.7}>
        謝謝光臨
      </text>
    </svg>
  );
}

// 硬幣堆上長出一株新芽：存下來的錢，會慢慢長大
function CoinSprout() {
  const coins = [0, 1, 2, 3, 4];
  const top = 176 - (coins.length - 1) * 13;
  // 葉子：從原點往右長的橢圓葉，加一條中脈
  const leaf = "M0 0 C 10 -13, 32 -15, 44 -3 C 32 7, 10 7, 0 0 Z";
  return (
    <svg viewBox="0 0 160 200" overflow="visible" {...line}>
      {coins.map((i) => {
        const y = 176 - i * 13;
        return (
          <g key={i}>
            <path d={`M35 ${y} V${y + 8} A45 10 0 0 0 125 ${y + 8} V${y}`} fill="var(--paper)" stroke="currentColor" />
            <path d={`M35 ${y + 8} A45 10 0 0 0 125 ${y + 8} V${y} H35 Z`} {...tint} stroke="none" />
            <ellipse cx="80" cy={y} rx="45" ry="10" fill="var(--paper)" stroke="currentColor" />
          </g>
        );
      })}
      <ellipse cx="80" cy={top} rx="45" ry="10" {...tint} stroke="currentColor" />
      <ellipse cx="80" cy={top} rx="34" ry="7" strokeOpacity={0.5} />
      {/* 新芽 */}
      <path d={`M80 ${top} C 78 ${top - 25}, 84 ${top - 45}, 80 ${top - 70}`} />
      <g transform={`translate(80 ${top - 70}) rotate(-28)`}>
        <path d={leaf} {...tint} fillOpacity={0.16} stroke="currentColor" />
        <path d="M2 0 L40 -3" strokeOpacity={0.5} />
      </g>
      <g transform={`translate(80 ${top - 62}) rotate(200) scale(1 -1)`}>
        <path d={leaf} {...tint} fillOpacity={0.16} stroke="currentColor" />
        <path d="M2 0 L40 -3" strokeOpacity={0.5} />
      </g>
      <g transform={`translate(81 ${top - 36}) rotate(-12) scale(0.55)`}>
        <path d={leaf} {...tint} fillOpacity={0.16} stroke="currentColor" />
      </g>
    </svg>
  );
}

// 橄欖枝：互生的細長葉片，掛著兩顆果實
function OliveSprig() {
  const leaves: [number, number, number][] = [
    [58, 220, -150],
    [56, 196, -30],
    [55, 170, -155],
    [57, 146, -25],
    [60, 120, -160],
    [62, 96, -35],
    [61, 72, -150],
    [58, 48, -40],
    [56, 26, -100],
  ];
  return (
    <svg viewBox="0 0 120 260" overflow="visible" {...line}>
      <path d="M60 252 C 52 190, 68 120, 56 20" />
      {leaves.map(([x, y, r]) => (
        <g key={y} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0 0 C 8 -6, 28 -6, 38 0 C 28 6, 8 6, 0 0 Z" {...tint} fillOpacity={0.14} stroke="currentColor" />
          <path d="M3 0 L34 0" strokeOpacity={0.45} />
        </g>
      ))}
      <ellipse cx="78" cy="134" rx="6" ry="8" {...tint} fillOpacity={0.25} stroke="currentColor" />
      <ellipse cx="38" cy="86" rx="5.5" ry="7.5" {...tint} fillOpacity={0.25} stroke="currentColor" />
    </svg>
  );
}

export default function DeskDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden overflow-hidden text-doodle xl:block">
      {/* 右側：錢幣草盆栽、算盤、收據 */}
      <div className="absolute right-[calc(50%-36rem)] top-14 w-48">
        <MoneyPlant />
      </div>
      <div className="absolute right-[calc(50%-37rem)] top-[34rem] w-56 -rotate-[9deg]">
        <Abacus />
      </div>
      <div className="absolute right-[calc(50%-33rem)] top-[58rem] w-32 rotate-[7deg]">
        <Receipt />
      </div>

      {/* 左側：長出新芽的硬幣堆、橄欖枝 */}
      <div className="absolute left-[calc(50%-38rem)] top-[24rem] w-40">
        <CoinSprout />
      </div>
      <div className="absolute left-[calc(50%-35rem)] top-[46rem] w-28 -rotate-[14deg]">
        <OliveSprig />
      </div>
    </div>
  );
}
