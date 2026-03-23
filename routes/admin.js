const express = require("express");
const { authRequired } = require("../middleware/auth");
const { adminRequired } = require("../middleware/admin");
const admin = require("../controllers/adminController");
const appConfig = require("../controllers/appConfigController");
const privateMarketInviteController = require("../controllers/privateMarketInviteController");

const router = express.Router();

router.use(authRequired, adminRequired);

router.get("/app-settings", appConfig.getAppSettingsAdmin);
router.patch("/app-settings", appConfig.patchAppSettingsAdmin);

router.get("/dashboard", admin.dashboard);
router.get("/revenue", admin.revenueDetail);

router.get("/users", admin.listUsers);
router.get("/users/:id", admin.getUser);
router.patch("/users/:id", admin.patchUser);

router.get("/listings", admin.listListings);
router.get("/listings/:id", admin.getListing);
router.patch("/listings/:id", admin.patchListing);

router.get("/reports", admin.listUserReports);
router.get("/reports/:id", admin.getUserReport);
router.patch("/reports/:id", admin.patchUserReport);

router.get("/support/tickets", admin.listSupportTickets);
router.get("/support/tickets/:id", admin.getSupportTicket);
router.post("/support/tickets/:id/messages", admin.postSupportReply);
router.patch("/support/tickets/:id", admin.patchSupportTicket);

router.post("/welcome-dm", admin.postWelcomeDm);

router.get(
  "/private-market-invites",
  privateMarketInviteController.adminList
);
router.post(
  "/private-market-invites",
  privateMarketInviteController.adminCreate
);
router.patch(
  "/private-market-invites/:id",
  privateMarketInviteController.adminPatch
);

module.exports = router;
