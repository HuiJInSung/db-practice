"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, AUTH_EVENT, type User } from "./ledger-api";

// 目前登入的使用者：undefined = 還在確認、null = 沒登入。
// session cookie 是 HTTP-only，前端讀不到，所以問 /api/auth/me；登入、註冊、登出後會重新確認
export function useCurrentUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<{ data: User | null }>("/api/auth/me")
        .then((res) => !cancelled && setUser(res.data))
        .catch(() => !cancelled && setUser(null));
    load();
    window.addEventListener(AUTH_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_EVENT, load);
    };
  }, []);

  return user;
}

// 沒登入時顯示在各頁的提示
export function LoginPrompt({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-sm italic text-ink-soft">
      請先
      <Link href="/login" className="mx-1 border-b border-ink-faint not-italic text-ink hover:border-ink">
        登入或註冊
      </Link>
      ，{children}
    </p>
  );
}
