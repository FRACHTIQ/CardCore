const express = require("express");
const marketStatsController = require("../controllers/marketStatsController");

const router = express.Router();

router.get("/market-live", marketStatsController.getMarketLive);

module.exports = router;
