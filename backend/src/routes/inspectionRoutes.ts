import express from "express";
import {
  createInspection,
  getInspection,
  updateInspectionState,
  addItemCondition,
  updateItemCondition,
  getPropertyInspections,
  submitInspection,
  reviewInspectionItem,
  reviewRoomEvidence,
  approveInspection,
  saveInspectionSignature,
  downloadInspectionReport,
} from "../controllers/inspectionController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router.post(
  "/",
  protect,
  authorize("Landlord", "Realtor", "Property Manager", "Tenant"),
  createInspection,
);
router.get("/property/:propertyId", protect, getPropertyInspections);
router.get("/:id/report.pdf", protect, downloadInspectionReport);
router.get("/:id", protect, getInspection);
router.put("/:id/state", protect, updateInspectionState);
router.post("/:id/items", protect, addItemCondition);
router.patch("/:id/items/:itemId", protect, updateItemCondition);
router.post("/:id/submit", protect, submitInspection);
router.post("/:id/items/:itemId/review", protect, reviewInspectionItem);
router.post("/:id/rooms/:roomId/evidence-decision", protect, reviewRoomEvidence);
router.post("/:id/approvals", protect, approveInspection);
router.post("/:id/acknowledge", protect, approveInspection);
router.post("/:id/signatures", protect, saveInspectionSignature);

export default router;
