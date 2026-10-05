import express from "express";
import {
  createInspection,
  getInspection,
  updateInspectionState,
  addItemCondition,
} from "../controllers/inspectionController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("Landlord", "Realtor", "Property Manager"),
  createInspection,
);
router.get("/:id", protect, getInspection);
router.put("/:id/state", protect, updateInspectionState);
router.post("/:id/items", protect, addItemCondition);

export default router;
