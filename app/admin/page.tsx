import type { Metadata } from "next";
import AdminApp from "./admin-app";

export const metadata: Metadata = { title: "後台" };

export default function AdminPage() {
  return (
    <>
      <h1 className="sr-only">管理者後台</h1>
      <AdminApp />
    </>
  );
}
