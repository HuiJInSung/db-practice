import type { Metadata } from "next";
import { Suspense } from "react";
import { EB_Garamond, Noto_Serif_TC } from "next/font/google";
import SiteNav from "./site-nav";
import DeskDecor from "./desk-decor";
import AuthStatus from "./auth-status";
import "./globals.css";

// 拉丁字母與數字用 EB Garamond，中文用思源宋體
const garamond = EB_Garamond({
  variable: "--font-garamond",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  weight: ["400", "500", "700"],
  preload: false, // 中文字型檔很大，不預先載入
});

export const metadata: Metadata = {
  title: { default: "記帳本", template: "%s · 記帳本" },
  description: "多人記帳網站",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-Hant"
      className={`${garamond.variable} ${notoSerifTC.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        <div className="relative z-10 flex flex-1 justify-center">
          {/* 帳本紙的橫線，鋪滿整頁並隨內容捲動 */}
          <div aria-hidden className="ledger-ruling" />
          {/* 兩側留白的桌面小物：銀杏、鋼筆、咖啡杯印（寬螢幕才顯示） */}
          <DeskDecor />

          <main className="relative w-full max-w-2xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
            {/* 左側朱紅雙線與直書標題，只在寬螢幕顯示 */}
            <div aria-hidden className="ledger-margin -left-[4.5rem] hidden lg:block" />
            <p
              aria-hidden
              className="absolute -left-10 top-24 hidden text-sm tracking-[0.6em] text-ink-faint [writing-mode:vertical-rl] lg:block"
            >
              收支手帖・日日是好日
            </p>

            <header className="relative mb-10 text-center">
              <AuthStatus />
              <p className="text-[0.7rem] uppercase tracking-[0.35em] text-ink-faint">
                Personal Ledger · <span className="italic normal-case tracking-normal">since 2026</span>
              </p>
              <div className="relative mx-auto mt-3 w-fit">
                <p className="text-4xl font-medium tracking-[0.2em] sm:text-5xl">記帳本</p>
                {/* 朱紅印章「量入為出」：依收入決定支出，古老的理財智慧 */}
                <span
                  aria-label="印章：量入為出"
                  role="img"
                  className="seal absolute -right-16 -top-3 scale-90 sm:-right-20 sm:scale-100"
                >
                  量入為出
                </span>
              </div>
              <div className="mx-auto mt-5 flex w-40 items-center gap-3 text-accent">
                <span className="h-px flex-1 bg-current opacity-50" />
                <span className="text-xs">✦</span>
                <span className="h-px flex-1 bg-current opacity-50" />
              </div>
              <p className="mt-4 text-sm italic text-ink-soft">一筆一筆，把日子記清楚。</p>

              <Suspense fallback={<div className="mt-9 h-[3.6rem]" />}>
                <SiteNav />
              </Suspense>
            </header>

            {children}

            <footer className="mt-20 text-center text-xs tracking-[0.3em] text-ink-faint">
              — 完 —
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
