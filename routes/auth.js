const express = require("express");
const authController = require("../controllers/authController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/verify-email", authRequired, authController.verifyEmail);
router.post(
  "/resend-verification",
  authRequired,
  authController.resendVerification
);

module.exports = router;
