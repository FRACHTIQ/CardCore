const express = require("express");
const supportController = require("../controllers/supportController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.post("/staff/tickets/:id/messages", supportController.staffReply);

router.post("/tickets", authRequired, supportController.createTicket);
router.get("/tickets", authRequired, supportController.listTickets);
router.get("/tickets/:id", authRequired, supportController.getTicket);
router.post("/tickets/:id/messages", authRequired, supportController.addUserMessage);

module.exports = router;
