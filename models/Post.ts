import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// 留言板文章：一個使用者可以有很多篇，每篇最多屬於一個使用者
const postSchema = new Schema(
  {
    // 作者。匿名文章不存 user：沒有人擁有它，所以也沒有人能刪除
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // 關聯到作者，可用 populate 取出名稱
    },
    title: {
      type: String,
      required: [true, "請填寫標題"],
      trim: true,
      maxlength: [60, "標題最多 60 個字"],
    },
    content: {
      type: String,
      required: [true, "請填寫內容"],
      trim: true,
      maxlength: [2000, "內容最多 2000 個字"],
    },
  },
  { timestamps: true }
);

// 留言板依發表時間由新到舊列出；刪除使用者時要找出他的所有文章
postSchema.index({ createdAt: -1 });
postSchema.index({ user: 1 });

export type Post = InferSchemaType<typeof postSchema>;

// 前端可以填的欄位（user 一律由後端決定）
export const POST_FIELDS = ["title", "content"] as const;

// Next.js 開發模式 hot reload 會重新執行這個檔案：先移除舊的 model 再註冊，
// 否則會報「重複註冊」錯誤，或一直沿用改 Schema 之前的舊 model
if (mongoose.models.Post) mongoose.deleteModel("Post");
const PostModel: Model<Post> = mongoose.model<Post>("Post", postSchema);

export default PostModel;
