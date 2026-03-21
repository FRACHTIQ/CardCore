const express = require("express");
const offerController = require("../controllers/offerController");
const { authRequired } = require("../middleware/auth");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.use(authRequired);
router.use(verifiedRequired);

router.get("/", offerController.listMine);
router.post("/", offerController.create);
router.post("/:id/withdraw", offerController.withdraw);
router.post("/:id/accept", offerController.accept);
router.post("/:id/reject", offerController.reject);

module.exports = router;
