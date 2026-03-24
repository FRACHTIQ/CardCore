const express = require("express");
const listingController = require("../controllers/listingController");
const listingAnalyticsController = require("../controllers/listingAnalyticsController");
const { authRequired } = require("../middleware/auth");
const { authOptional } = require("../middleware/authOptional");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.get("/", authOptional, listingController.list);
router.get(
  "/:id/analytics",
  authRequired,
  listingAnalyticsController.getListingAnalytics
);
router.get("/:id", authOptional, listingController.getById);
router.post("/", authRequired, verifiedRequired, listingController.create);
router.patch("/:id", authRequired, verifiedRequired, listingController.update);
router.delete("/:id", authRequired, verifiedRequired, listingController.archive);

module.exports = router;
