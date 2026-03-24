const express = require("express");
const { authRequired } = require("../middleware/auth");
const privateMarketInviteController = require("../controllers/privateMarketInviteController");

const router = express.Router();

router.post("/redeem", authRequired, privateMarketInviteController.redeem);

module.exports = router;
