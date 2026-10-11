import type { Metadata } from "next";
import UploadApp from "./upload-app";

export const metadata: Metadata = { title: "圖片" };

export default function UploadPage() {
  return (
    <>
      <h1 className="sr-only">上傳圖片</h1>
      <UploadApp />
    </>
  );
}
