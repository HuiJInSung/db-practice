import type { Metadata } from "next";
import BoardApp from "./board-app";

export const metadata: Metadata = { title: "留言板" };

export default function BoardPage() {
  return (
    <>
      <h1 className="sr-only">留言板</h1>
      <BoardApp />
    </>
  );
}
