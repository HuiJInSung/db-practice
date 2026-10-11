import type { Metadata } from "next";
import { Suspense } from "react";
import StatsApp from "./stats-app";

export const metadata: Metadata = { title: "月報" };

export default function StatsPage() {
  return (
    <>
      <h1 className="sr-only">月支出分類統計</h1>
      {/* StatsApp 用「這個月」當預設月份，要在每次造訪時才 render，不能在 build 時預先產生 */}
      <Suspense fallback={<p className="text-center text-sm text-ink-faint">翻開月報中…</p>}>
        <StatsApp />
      </Suspense>
    </>
  );
}
