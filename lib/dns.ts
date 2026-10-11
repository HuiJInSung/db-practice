import dns from "node:dns";

// mongodb+srv:// 需要查 SRV 紀錄。有些電腦上 Node 的 DNS 會指到 127.0.0.1 而查詢失敗，
// 這時可在 .env.local 設定 MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1 指定 DNS 伺服器。
if (process.env.MONGODB_DNS_SERVERS) {
  const servers = process.env.MONGODB_DNS_SERVERS.split(",").map((s) => s.trim());
  dns.setServers(servers);
  // mongodb 套件查 SRV 時用的是 dns.promises，要一起設定
  dns.promises.setServers(servers);
}
