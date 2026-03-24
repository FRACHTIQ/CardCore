const express = require("express");
const dealController = require("../controllers/dealController");
const { authRequired } = require("../middleware/auth");
const { verifiedRequired } = require("../middleware/verified");

const router = express.Router();

router.use(authRequired);
router.use(verifiedRequired);

router.get("/", dealController.listMine);
router.get("/:id", dealController.getById);
router.patch("/:id", dealController.patchDeal);

module.exports = router;
