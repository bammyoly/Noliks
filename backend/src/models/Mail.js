import mongoose from "mongoose";

const MailSchema = new mongoose.Schema(
  {
    mailId: { type: Number, index: true }, // on-chain id
    from:   { type: String, required: true, lowercase: true, index: true },
    to:     { type: String, required: true, lowercase: true, index: true },
    cid:    { type: String, default: "" }, // points to encrypted blob on IPFS
    txHash: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Mail", MailSchema);
