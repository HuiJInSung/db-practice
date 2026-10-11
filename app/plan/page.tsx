import type { Metadata } from "next";
import { Suspense } from "react";
import PlanApp from "./plan-app";

export const metadata: Metadata = { title: "規劃" };

export default function PlanPage() {
  return (
    <>
      <h1 className="sr-only">每月財務規劃</h1>
      {/* PlanApp 用「這個月」當預設月份，要在每次造訪時才 render，不能在 build 時預先產生 */}
      <Suspense fallback={<p className="text-center text-sm text-ink-faint">翻開規劃中…</p>}>
        <PlanApp />
      </Suspense>
    </>
  );
}
