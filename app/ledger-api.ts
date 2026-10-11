// 前端共用：呼叫 API 的小工具與型別

export type User = { _id: string; name: string; email?: string; role?: "admin" | "user"; avatarUrl?: string };
export type ApiError = { error: string; details?: Record<string, string> };

// 呼叫 API：成功回傳 JSON，失敗時丟出 ApiError
// 登入狀態存在 HTTP-only cookie，同網域的 fetch 會自動帶上，不用另外傳使用者
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => ({ error: `請求失敗（${res.status}）` }));
  if (!res.ok) throw body as ApiError;
  return body as T;
}

// 驗證訊息已經是完整的中文句子，直接串起來顯示
export function errorText(err: unknown) {
  const e = err as ApiError;
  if (!e?.error) return "無法連線到伺服器";
  if (!e.details) return e.error;
  return Object.values(e.details).join("；");
}

// 日期都以台灣時間顯示與輸入
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" });
export const toDay = (iso: string | Date) => dayFormatter.format(new Date(iso)); // YYYY-MM-DD
export const today = () => toDay(new Date());
export const money = (n: number) => n.toLocaleString("zh-TW");

// 2026 → 二〇二六；10 → 十月
const CN_DIGITS = "〇一二三四五六七八九";
export const CN_MONTHS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
export const cnYear = (y: string) => [...y].map((d) => CN_DIGITS[Number(d)]).join("");

// "2026-10" 往前或往後移幾個月
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 登入、註冊、登出後發出這個事件，讓頁首與各頁重新讀取登入狀態
export const AUTH_EVENT = "ledger:auth-changed";

// 共用樣式
export const lineInput =
  "w-full border-0 border-b border-rule bg-transparent px-0 py-2 text-ink outline-none transition-colors placeholder:text-ink-faint/70 focus:border-ink";
export const label = "text-[0.7rem] uppercase tracking-[0.25em] text-ink-faint";
export const textButton =
  "text-xs tracking-widest text-ink-faint transition-colors hover:text-ink disabled:pointer-events-none disabled:opacity-30";
export const inkButton =
  "rounded-full bg-ink px-6 py-2 text-sm tracking-[0.3em] text-paper transition-opacity hover:opacity-85 disabled:opacity-40";
