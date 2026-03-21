const express = require("express");
const listingController = require("../controllers/listingController");
const { authRequired } = require("../middleware/auth");
const { authOptional } = require("../middleware/authOptional");

const router = express.Router();

router.get("/", authOptional, listingController.list);
router.get("/:id", authOptional, listingController.getById);
router.post("/", authRequired, listingController.create);
router.patch("/:id", authRequired, listingController.update);
router.delete("/:id", authRequired, listingController.archive);

module.exports = router;
