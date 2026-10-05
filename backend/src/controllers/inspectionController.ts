import { Response, NextFunction } from 'express';
import Inspection from '../models/Inspection';
import Property from '../models/Property';
import { AuthRequest } from '../middlewares/authMiddleware';
import mongoose from 'mongoose';

export const createInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, mode } = req.body;

    const property = await Property.findById(propertyId);
    if (!property || property.ownerId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized for this property');
    }

    const inspection = await Inspection.create({
      propertyId,
      landlordId: req.user._id,
      mode: mode || 'Full',
      state: 'DRAFT',
      items: [],
    });

    res.status(201).json(inspection);
  } catch (error) {
    next(error);
  }
};

export const getInspection = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const inspection = await Inspection.findById(req.params.id)
      .populate('propertyId')
      .populate('landlordId', 'name email role')
      .populate('tenantId', 'name email role');

    if (!inspection) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    // After populate, landlordId / tenantId are hydrated documents — use type assertion to access _id
    const landlordDoc = inspection.landlordId as any;
    const tenantDoc = inspection.tenantId as any;

    const isLandlord = landlordDoc._id.toString() === req.user._id.toString();
    const isTenant = tenantDoc && tenantDoc._id.toString() === req.user._id.toString();

    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized to access this inspection');
    }

    res.json(inspection);
  } catch (error) {
    next(error);
  }
};

export const updateInspectionState = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { state } = req.body;

    // Validate state value
    const validStates = ['DRAFT', 'IN_PROGRESS', 'UNDER_REVIEW', 'READ_ONLY'];
    if (!validStates.includes(state)) {
      res.status(400);
      throw new Error(`Invalid state. Must be one of: ${validStates.join(', ')}`);
    }

    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    const userId = req.user._id.toString();
    const isLandlord = inspection.landlordId.toString() === userId;
    const isTenant = inspection.tenantId && inspection.tenantId.toString() === userId;

    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized');
    }

    inspection.state = state;
    await inspection.save();

    res.json(inspection);
  } catch (error) {
    next(error);
  }
};

export const addItemCondition = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId, itemName, condition, notes } = req.body;

    // Validate condition
    const validConditions = ['Good', 'Fair', 'Damaged', 'N/A'];
    if (!validConditions.includes(condition)) {
      res.status(400);
      throw new Error(`Invalid condition. Must be one of: ${validConditions.join(', ')}`);
    }

    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    if (inspection.state === 'READ_ONLY') {
      res.status(400);
      throw new Error('Cannot modify a read-only inspection');
    }

    // Only landlord or tenant linked to this inspection can add items
    const userId = req.user._id.toString();
    const isLandlord = inspection.landlordId.toString() === userId;
    const isTenant = inspection.tenantId && inspection.tenantId.toString() === userId;

    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized to modify this inspection');
    }

    inspection.items.push({
      roomId: new mongoose.Types.ObjectId(roomId),
      itemName,
      condition,
      notes,
      evidence: [],
    } as any);

    await inspection.save();

    res.status(201).json(inspection);
  } catch (error) {
    next(error);
  }
};
