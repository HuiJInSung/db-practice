"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, AUTH_EVENT } from "./ledger-api";
import { useCurrentUser } from "./current-user";
import { Avatar } from "./avatar";

// 頁首右上角：顯示目前登入的帳號與登出按鈕
export default function AuthStatus() {
  const router = useRouter();
  const user = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.dispatchEvent(new Event(AUTH_EVENT));
      router.push("/login");
    } finally {
      setBusy(false);
    }
  }

  const base = "absolute right-0 -top-8 flex items-center gap-3 text-xs tracking-widest sm:-top-10";

  if (user === undefined) return <div aria-hidden className={base} />;

  if (!user) {
    return (
      <div className={base}>
        <Link href="/login" className="text-ink-faint transition-colors hover:text-ink">
          登入 · 註冊
        </Link>
      </div>
    );
  }

  return (
    <div className={base}>
      {/* 顯示大頭照與使用者名稱，滑過時看得到 email；點一下到圖片頁更換大頭照 */}
      <Link href="/upload" className="flex items-center gap-2 text-ink-soft hover:text-ink" title={user.email}>
        <Avatar user={user} className="h-6 w-6 text-[0.65rem]" />
        {user.name}
      </Link>
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        className="text-ink-faint transition-colors hover:text-seal disabled:opacity-40"
      >
        登出
      </button>
    </div>
  );
}
