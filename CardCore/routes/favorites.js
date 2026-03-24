const express = require("express");
const favoriteController = require("../controllers/favoriteController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

router.get("/", favoriteController.listMine);
router.get("/check/:listingId", favoriteController.check);
router.post("/:listingId", favoriteController.add);
router.delete("/:listingId", favoriteController.remove);

module.exports = router;
