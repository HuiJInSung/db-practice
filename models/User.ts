import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "請填寫名稱"],
      trim: true,
      maxlength: [50, "名稱最多 50 個字"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "email 格式不正確"],
    }, // 選填
    // bcrypt 雜湊後的密碼，絕不存明碼。select: false 讓一般查詢不會帶出來，登入時才用 +passwordHash 取出。
    // 舊的「持帳人」（用 /api/users 建立的）沒有密碼，所以暫時是選填
    passwordHash: { type: String, select: false },
    // 使用者身份：admin 可以進後台管理全部資料。註冊一律是 user；
    // 只有管理者能在後台改別人的身份（PATCH /api/admin/users/:id），第一位管理者用 scripts/set-role.mjs 設定
    role: {
      type: String,
      enum: { values: ["admin", "user"], message: "身份只能是管理者或一般使用者" },
      default: "user",
    },
    // 大頭照：上傳到 Vercel Blob 後拿到的公開網址（https://….public.blob.vercel-storage.com/avatars/<id>/…）。
    // 只能透過 PUT /api/auth/me/avatar 設定，伺服器自己上傳後才寫入，前端無法塞任意網址進來
    avatarUrl: { type: String },
  },
  { timestamps: true } // 自動加上 createdAt / updatedAt
);

// 有填 email 時不能重複。不能直接用 unique: true，
// 因為沒填 email 的使用者會被當成 null，第二個沒填的人就會撞到重複。
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

export type User = InferSchemaType<typeof userSchema>;

// Next.js 開發模式 hot reload 會重新執行這個檔案：先移除舊的 model 再註冊，
// 否則會報「重複註冊」錯誤，或一直沿用改 Schema 之前的舊 model
if (mongoose.models.User) mongoose.deleteModel("User");
const UserModel: Model<User> = mongoose.model<User>("User", userSchema);

export default UserModel;
