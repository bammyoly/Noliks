import express from "express";
import {
  sendMail,
  getInboxMails,
  getSentMails,
  getMessageById,
  getMessageByTx,
} from "../controllers/mailController.js";

const router = express.Router();

// Routes
router.post("/send", sendMail);
router.get("/inbox/:address", getInboxMails);
router.get("/sent/:address", getSentMails);
router.get("/message/:id", getMessageById);
router.get("/by-tx/:txHash", getMessageByTx);


export default router;
