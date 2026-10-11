import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <>
      <h1 className="sr-only">登入或註冊</h1>
      <LoginForm />
    </>
  );
}
