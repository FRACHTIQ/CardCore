const express = require("express");
const userController = require("../controllers/userController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/me", authRequired, userController.getMe);
router.patch("/me", authRequired, userController.patchMe);
router.delete("/me", authRequired, userController.deleteMe);
router.get("/:id", userController.getPublicProfile);

module.exports = router;
