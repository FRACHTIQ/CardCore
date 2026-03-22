const express = require("express");
const conversationController = require("../controllers/conversationController");
const { authRequired } = require("../middleware/auth");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.use(authRequired);

router.get("/", conversationController.listMine);
router.post("/", verifiedRequired, conversationController.openOrCreate);
router.get("/:id/messages", conversationController.getMessages);
router.post("/:id/messages", conversationController.postMessage);
router.delete(
  "/:id/messages/:messageId",
  conversationController.deleteMessage
);

module.exports = router;
