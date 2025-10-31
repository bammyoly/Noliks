import mongoose from "mongoose";

const MailSchema = new mongoose.Schema(
  {
    // on-chain/meta
    mailId: { type: Number, index: true },
    from:   { type: String, required: true, lowercase: true, index: true },
    to:     { type: String, required: true, lowercase: true, index: true },
    cid:    { type: String, default: "" },
    txHash: { type: String, required: true, index: true },

    subject:{ type: String },
    body:   { type: String },          

    // optional props
    timestamp:   { type: Date },
    unread:      { type: Boolean },
    chainId:     { type: Number },
    contract:    { type: String },
    blockNumber: { type: Number },
    mode:        { type: String, enum: ["real","mock","tx-first"] },
  },
  { timestamps: true, strict: true }
);

MailSchema.index({ txHash: 1 });

export default mongoose.model("Mail", MailSchema);
