const express = require("express");
const userController = require("../controllers/userController");
const pushTokenController = require("../controllers/pushTokenController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.get("/me", authRequired, userController.getMe);
router.patch("/me", authRequired, userController.patchMe);
router.post("/me/presence", authRequired, userController.heartbeatPresence);
router.delete("/me", authRequired, userController.deleteMe);
router.post("/me/push-token", authRequired, pushTokenController.putPushToken);
router.delete("/me/push-token", authRequired, pushTokenController.deletePushTokens);
router.get("/:id", userController.getPublicProfile);

module.exports = router;
