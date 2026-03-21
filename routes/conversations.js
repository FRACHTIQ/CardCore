const express = require("express");
const conversationController = require("../controllers/conversationController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

router.get("/", conversationController.listMine);
router.post("/", conversationController.openOrCreate);
router.get("/:id/messages", conversationController.getMessages);
router.post("/:id/messages", conversationController.postMessage);

module.exports = router;
