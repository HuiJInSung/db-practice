import { Suspense } from "react";
import TransactionsApp from "./transactions-app";

export default function Home() {
  return (
    <>
      <h1 className="sr-only">帳本</h1>
      {/* TransactionsApp 用「今天」當預設日期，要在每次造訪時才 render，不能在 build 時預先產生 */}
      <Suspense fallback={<p className="text-center text-sm text-ink-faint">翻開帳本中…</p>}>
        <TransactionsApp />
      </Suspense>
    </>
  );
}
