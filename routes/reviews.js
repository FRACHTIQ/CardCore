const express = require("express");
const reviewController = require("../controllers/reviewController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.post("/", authRequired, reviewController.create);

module.exports = router;
