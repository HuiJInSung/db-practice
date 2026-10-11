"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, AUTH_EVENT, errorText, inkButton, label, lineInput, type User } from "../ledger-api";

type Mode = "login" | "register";

// 登入 / 註冊表單：成功後伺服器會設定 HTTP-only cookie，前端只負責通知頁首並回到帳本
export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<{ data: User }>(`/api/auth/${mode}`, {
        method: "POST",
        // 登入只需要 email 與密碼；註冊時多帶使用者名稱
        body: JSON.stringify(mode === "register" ? { name, email, password } : { email, password }),
      });
      window.dispatchEvent(new Event(AUTH_EVENT));
      router.push("/");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <section className="mx-auto max-w-sm rounded-sm bg-paper-raised/80 px-8 py-10 shadow-[0_8px_30px_-18px_rgba(60,40,20,0.5)]">
      <div role="tablist" className="mb-8 flex justify-center gap-8 text-sm tracking-[0.4em]">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`border-b pb-1 pl-[0.4em] transition-colors ${
              mode === m ? "border-seal text-ink" : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            {m === "login" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-6">
        {!isLogin && (
          <label className="block">
            <span className={label}>使用者名稱</span>
            <input
              required
              maxLength={50}
              autoComplete="nickname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={lineInput}
              placeholder="例如：小明"
            />
          </label>
        )}
        <label className="block">
          <span className={label}>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={lineInput}
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className={label}>密碼</span>
          <input
            type="password"
            required
            minLength={isLogin ? undefined : 8}
            // 讓瀏覽器的密碼管理員知道這是登入還是建立新密碼
            autoComplete={isLogin ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={lineInput}
            placeholder={isLogin ? "" : "至少 8 個字元"}
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        )}

        <div className="pt-2 text-center">
          <button type="submit" disabled={busy} className={inkButton}>
            {busy ? "處理中…" : isLogin ? "登入" : "註冊"}
          </button>
        </div>
      </form>
    </section>
  );
}
