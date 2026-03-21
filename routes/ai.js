const express = require("express");
const aiController = require("../controllers/aiController");

const router = express.Router();

router.get("/status", aiController.status);

module.exports = router;
