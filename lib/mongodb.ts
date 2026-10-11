import "./dns"; // 套用 MONGODB_DNS_SERVERS 設定
import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("請在 .env.local 設定 MONGODB_URI");
}

// 把連線存在 globalThis 上：正式環境所有 API Route 共用同一個連線，
// 開發模式下 hot reload 重新執行這個模組時，也不會每次存檔都開一個新連線。
const globalForMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function connect(): Promise<MongoClient> {
  const promise = new MongoClient(uri!).connect();
  // 連線失敗時清掉快取，下次呼叫會重新連線，而不是一直拿到同一個失敗結果
  promise.catch(() => {
    if (globalForMongo._mongoClientPromise === promise) {
      globalForMongo._mongoClientPromise = undefined;
    }
  });
  return promise;
}

// 取得共用的 MongoClient（第一次呼叫時才建立連線）
export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    globalForMongo._mongoClientPromise = connect();
  }
  return globalForMongo._mongoClientPromise;
}

// 取得資料庫：沒傳名稱時用 MONGODB_DB，再沒有就用 URI 裡指定的資料庫
export async function getDb(dbName = process.env.MONGODB_DB): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}
