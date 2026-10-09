import express from "express";
import {
  createInvitation,
  resolveInvitation,
} from "../controllers/invitationController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("Landlord", "Realtor", "Property Manager"),
  createInvitation,
);
router.post("/resolve/:token", resolveInvitation);

export default router;
