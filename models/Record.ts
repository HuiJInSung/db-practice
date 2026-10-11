import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const recordSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User", // 關聯到 User，可用 populate 取出使用者資料
      required: [true, "缺少使用者"], // 每筆紀錄一定要屬於某個使用者
    },
    type: {
      type: String,
      enum: { values: ["income", "expense"], message: "類型只能是收入或支出" },
      required: [true, "請選擇收入或支出"],
    },
    amount: {
      type: Number,
      required: [true, "請填寫金額"],
      min: [0, "金額不能是負數"],
      // 存整數避免浮點數誤差；之後若要支援有小數的外幣，改存「分」
      validate: { validator: Number.isInteger, message: "金額必須是整數" },
    },
    category: { type: String, required: [true, "請填寫分類"], trim: true }, // 例如：餐飲、交通、薪水
    note: { type: String, trim: true, maxlength: [200, "備註最多 200 個字"] },
    date: { type: Date, required: [true, "請填寫日期"], default: Date.now }, // 消費日期（可以和建立時間不同）
  },
  { timestamps: true }
);

// 最常見的查詢是「某使用者的紀錄，依日期排序」，所以建立複合索引
recordSchema.index({ user: 1, date: -1 });

export type Record = InferSchemaType<typeof recordSchema>;

// 前端可以新增/修改的欄位（user 一律由後端決定）
export const EDITABLE_FIELDS = ["type", "amount", "category", "note", "date"] as const;

// Next.js 開發模式 hot reload 會重新執行這個檔案：先移除舊的 model 再註冊，
// 否則會報「重複註冊」錯誤，或一直沿用改 Schema 之前的舊 model
if (mongoose.models.Record) mongoose.deleteModel("Record");
const RecordModel: Model<Record> = mongoose.model<Record>("Record", recordSchema);

export default RecordModel;
