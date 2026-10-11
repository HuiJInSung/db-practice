import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import User from "@/models/User";
import Transaction from "@/models/Record";
import Post from "@/models/Post";
import Budget from "@/models/Budget";

// 依 user 分組計算筆數，再轉成 { userId: 數量 }
type CountRow = { _id: unknown; n: number };
const COUNT_BY_USER = [{ $group: { _id: "$user", n: { $sum: 1 } } }];
const toCountMap = (rows: CountRow[]) => Object.fromEntries(rows.map((r) => [String(r._id), r.n]));

// GET /api/admin/users：所有使用者，附上每人的記帳、文章、規劃數量
// 回傳 { data: [{ _id, name, email, role, hasPassword, createdAt, records, posts, budgets }] }
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  try {
    const [users, records, posts, budgets] = await Promise.all([
      User.find().select("name email role createdAt +passwordHash").sort({ createdAt: 1 }).lean(),
      Transaction.aggregate<CountRow>(COUNT_BY_USER).then(toCountMap),
      Post.aggregate<CountRow>(COUNT_BY_USER).then(toCountMap),
      Budget.aggregate<CountRow>(COUNT_BY_USER).then(toCountMap),
    ]);
    const data = users.map(({ passwordHash, ...u }) => ({
      ...u,
      role: u.role ?? "user",
      hasPassword: !!passwordHash, // 沒有密碼 = 舊的持帳人，還不能登入
      records: records[String(u._id)] ?? 0,
      posts: posts[String(u._id)] ?? 0,
      budgets: budgets[String(u._id)] ?? 0,
    }));
    return Response.json({ data });
  } catch (err) {
    return handleError(err);
  }
}
