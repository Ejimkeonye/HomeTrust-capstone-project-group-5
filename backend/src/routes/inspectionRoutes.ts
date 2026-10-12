import express from "express";
import {
  createInspection,
  getInspection,
  updateInspectionState,
  addItemCondition,
  updateItemCondition,
  getPropertyInspections,
  submitInspection,
} from "../controllers/inspectionController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("Landlord", "Realtor", "Property Manager"),
  createInspection,
);
router.get("/property/:propertyId", protect, getPropertyInspections);
router.get("/:id", protect, getInspection);
router.put("/:id/state", protect, updateInspectionState);
router.post("/:id/items", protect, addItemCondition);
router.patch("/:id/items/:itemId", protect, updateItemCondition);
router.post("/:id/submit", protect, submitInspection);

export default router;
