import "./dns"; // 套用 MONGODB_DNS_SERVERS 設定
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("請在 .env.local 設定 MONGODB_URI");
}

// 和 lib/mongodb.ts 一樣把連線存在 globalThis 上，
// 避免開發模式 hot reload 時每次存檔都開一個新連線。
const globalForMongoose = globalThis as typeof globalThis & {
  _mongooseConnPromise?: Promise<typeof mongoose>;
};

function connect(): Promise<typeof mongoose> {
  // 沒設定 MONGODB_DB 時，用 URI 裡指定的資料庫
  const promise = mongoose.connect(uri!, { dbName: process.env.MONGODB_DB });
  // 連線失敗時清掉快取，下次呼叫會重新連線，而不是一直拿到同一個失敗結果
  promise.catch(() => {
    if (globalForMongoose._mongooseConnPromise === promise) {
      globalForMongoose._mongooseConnPromise = undefined;
    }
  });
  return promise;
}

// 使用 model 前先 await connectDB()（第一次呼叫時才建立連線）
export function connectDB(): Promise<typeof mongoose> {
  if (!globalForMongoose._mongooseConnPromise) {
    globalForMongoose._mongooseConnPromise = connect();
  }
  return globalForMongoose._mongooseConnPromise;
}
