import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// 每個月的財務規劃：一位使用者一個月一份，內含收入與費用的預算項目
const itemSchema = new Schema({
  type: {
    type: String,
    enum: { values: ["income", "expense"], message: "類型只能是收入或費用" },
    required: [true, "請選擇收入或費用"],
  },
  name: {
    type: String,
    required: [true, "請填寫項目名稱"],
    trim: true,
    maxlength: [30, "項目名稱最多 30 個字"],
  },
  amount: {
    type: Number,
    required: [true, "請填寫金額"],
    min: [0, "金額不能是負數"],
    validate: { validator: Number.isInteger, message: "金額必須是整數" },
  },
});

const budgetSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: [true, "缺少使用者"] },
    month: { type: String, required: [true, "缺少月份"], match: [/^\d{4}-\d{2}$/, "月份格式應為 YYYY-MM"] },
    items: { type: [itemSchema], default: [] },
  },
  { timestamps: true }
);

// 一位使用者每個月只有一份規劃
budgetSchema.index({ user: 1, month: 1 }, { unique: true });

export type Budget = InferSchemaType<typeof budgetSchema>;

// 還沒規劃過任何月份時，預設帶入的項目（金額先填 0）
export const DEFAULT_ITEMS = [
  { type: "income", name: "薪資收入" },
  ...[
    "父親醫療費",
    "捐款",
    "健身房費",
    "健身房櫃子費",
    "ClaudeCode",
    "定期存股",
    "電話費",
    "手機費",
    "交通費",
    "伙食費",
    "垃圾費",
    "水費",
    "電費",
    "瓦斯費",
  ].map((name) => ({ type: "expense", name })),
].map((item) => ({ ...item, amount: 0 }));

// 開發模式 hot reload 時先移除舊 model 再註冊（同 models/Record.ts）
if (mongoose.models.Budget) mongoose.deleteModel("Budget");
const BudgetModel: Model<Budget> = mongoose.model<Budget>("Budget", budgetSchema);

export default BudgetModel;
