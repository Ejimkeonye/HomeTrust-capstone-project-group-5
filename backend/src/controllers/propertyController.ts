import { Response, NextFunction } from "express";
import Property from "../models/Property";
import { AuthRequest } from "../middlewares/authMiddleware";

export const createProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { name, address, type, rooms } = req.body;

    const property = await Property.create({
      name,
      address,
      type,
      rooms: rooms || [],
      ownerId: req.user._id,
    });

    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
};

export const getProperties = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const properties = await Property.find({ ownerId: req.user._id })
      .skip(skip)
      .limit(limit);

    const total = await Property.countDocuments({ ownerId: req.user._id });

    res.json({
      properties,
      page,
      pages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProperty = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    if (property.ownerId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error("User not authorized to update this property");
    }

    const updatedProperty = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );

    res.json(updatedProperty);
  } catch (error) {
    next(error);
  }
};

export const getPropertyById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      res.status(404);
      throw new Error("Property not found");
    }

    // Check if user is owner or invited tenant (Tenant logic will be handled later, for now owner)
    // For simplicity, returning if requested
    res.json(property);
  } catch (error) {
    next(error);
  }
};
