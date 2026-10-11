"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "./current-user";

const TABS = [
  { href: "/", label: "帳本", en: "Ledger" },
  { href: "/stats", label: "月報", en: "Report" },
  { href: "/plan", label: "規劃", en: "Budget" },
  { href: "/board", label: "留言板", en: "Notes" },
  { href: "/upload", label: "圖片", en: "Photos" },
  { href: "/admin", label: "後台", en: "Admin", adminOnly: true },
];

// 頁首的分頁：做成筆記本的索引標籤，目前頁面的標籤浮在分隔線上
export default function SiteNav() {
  const pathname = usePathname();
  const me = useCurrentUser();
  // 後台分頁只有管理者看得到（真正的權限檢查在 API）
  const tabs = TABS.filter((tab) => !tab.adminOnly || me?.role === "admin");

  return (
    <nav aria-label="分頁" className="mt-9 flex justify-center gap-2 border-b border-ink/25 px-2">
      {tabs.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex min-w-0 flex-1 flex-col items-center rounded-t-md border px-1 pb-2 pt-2.5 sm:min-w-24 sm:flex-none sm:px-5 transition-colors ${
              active
                ? "border-ink/25 border-b-paper-raised border-t-2 border-t-seal bg-paper-raised text-ink shadow-[0_-4px_12px_-8px_rgba(60,40,20,0.35)]"
                : "border-transparent bg-ink/[0.04] text-ink-soft hover:bg-ink/[0.08] hover:text-ink"
            }`}
          >
            <span className="whitespace-nowrap text-sm tracking-[0.15em] pl-[0.15em] sm:text-base sm:tracking-[0.4em] sm:pl-[0.4em]">{tab.label}</span>
            <span
              className={`mt-0.5 text-[0.6rem] uppercase tracking-[0.15em] italic sm:tracking-[0.3em] ${
                active ? "text-seal" : "text-ink-faint"
              }`}
            >
              {tab.en}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
