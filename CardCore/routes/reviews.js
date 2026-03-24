const express = require("express");
const reviewController = require("../controllers/reviewController");
const { authRequired } = require("../middleware/auth");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.get("/seller/:sellerId", reviewController.listBySeller);
router.post("/", authRequired, verifiedRequired, reviewController.create);

module.exports = router;
