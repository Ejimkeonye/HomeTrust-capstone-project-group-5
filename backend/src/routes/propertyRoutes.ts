import express from "express";
import {
  createProperty,
  getProperties,
  updateProperty,
  getPropertyById,
  deleteProperty,
} from "../controllers/propertyController";
import { protect, authorize } from "../middlewares/authMiddleware";

const router = express.Router();

router
  .route("/")
  .post(
    protect,
    authorize("Landlord", "Realtor", "Property Manager", "Tenant"),
    createProperty,
  )
  .get(protect, getProperties);

router
  .route("/:id")
  .get(protect, getPropertyById)
  .put(
    protect,
    authorize("Landlord", "Realtor", "Property Manager", "Tenant"),
    updateProperty,
  )
  .delete(
    protect,
    authorize("Landlord", "Realtor", "Property Manager", "Tenant"),
    deleteProperty,
  );

export default router;
