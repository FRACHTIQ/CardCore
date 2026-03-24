const express = require("express");
const aiController = require("../controllers/aiController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/status", aiController.status);
router.post("/analyze-card", authRequired, aiController.analyzeCard);

module.exports = router;
