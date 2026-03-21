const express = require("express");
const reviewController = require("../controllers/reviewController");
const { authRequired } = require("../middleware/auth");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.post("/", authRequired, verifiedRequired, reviewController.create);

module.exports = router;
