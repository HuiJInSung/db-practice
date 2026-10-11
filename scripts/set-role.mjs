// 設定使用者身份（管理者 / 一般使用者）。平常由管理者在後台修改；
// 還沒有任何管理者、或管理者被鎖在外面時，才在本機執行這支腳本：
//   node --env-file=.env.local scripts/set-role.mjs huijinsung@gmail.com admin
//   node --env-file=.env.local scripts/set-role.mjs someone@example.com user
import dns from "node:dns";
import mongoose from "mongoose";

const [email, role] = process.argv.slice(2);
if (!email || !["admin", "user"].includes(role)) {
  console.error("用法：node --env-file=.env.local scripts/set-role.mjs <email> <admin|user>");
  process.exit(1);
}

// 和 lib/dns.ts 一樣，有設定時改用指定的 DNS 伺服器查 mongodb+srv
if (process.env.MONGODB_DNS_SERVERS) {
  const servers = process.env.MONGODB_DNS_SERVERS.split(",").map((s) => s.trim());
  dns.setServers(servers);
  dns.promises.setServers(servers);
}

await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB });
const result = await mongoose.connection
  .collection("users")
  .findOneAndUpdate({ email: email.trim().toLowerCase() }, { $set: { role } }, { returnDocument: "after" });
await mongoose.disconnect();

if (!result) {
  console.error(`找不到 email 為 ${email} 的使用者`);
  process.exit(1);
}
console.log(`已將 ${result.name}（${result.email}）設為 ${role === "admin" ? "管理者" : "一般使用者"}`);
