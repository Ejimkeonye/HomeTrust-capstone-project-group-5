import { Response, NextFunction } from 'express';
import Inspection from '../models/Inspection';
import { AuthRequest } from '../middlewares/authMiddleware';

export const uploadEvidence = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { inspectionId, itemId } = req.params;

    if (!req.file) {
      res.status(400);
      throw new Error('No file uploaded');
    }

    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      res.status(404);
      throw new Error('Inspection not found');
    }

    // Authorization: only landlord or linked tenant can upload evidence
    const userId = req.user._id.toString();
    const isLandlord = inspection.landlordId.toString() === userId;
    const isTenant = inspection.tenantId && inspection.tenantId.toString() === userId;

    if (!isLandlord && !isTenant) {
      res.status(403);
      throw new Error('Not authorized to upload evidence for this inspection');
    }

    if (inspection.state === 'READ_ONLY') {
      res.status(400);
      throw new Error('Cannot upload evidence to a read-only inspection');
    }

    // Find item by _id (Mongoose subdoc exposes _id as a virtual)
    const item = inspection.items.find(
      (i) => (i as any)._id?.toString() === itemId
    );
    if (!item) {
      res.status(404);
      throw new Error('Item not found in this inspection');
    }

    // In production this would be an S3/GCS URL from the upload service
    const fileUrl = `/uploads/${req.file.filename}`;

    const evidenceData = {
      url: fileUrl,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'image',
      uploadedBy: req.user._id,
      clientMetadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
    };

    item.evidence.push(evidenceData as any);
    await inspection.save();

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};
