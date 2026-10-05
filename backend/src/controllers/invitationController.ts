import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Invitation from '../models/Invitation';
import Property from '../models/Property';
import Inspection from '../models/Inspection';
import User from '../models/User';
import { AuthRequest } from '../middlewares/authMiddleware';

export const createInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { propertyId, inspectionId, email } = req.body;

    // Check ownership
    const property = await Property.findById(propertyId);
    if (!property || property.ownerId.toString() !== req.user._id.toString()) {
      res.status(403);
      throw new Error('Not authorized to invite for this property');
    }

    // Verify the inspection belongs to this property
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection || inspection.propertyId.toString() !== propertyId) {
      res.status(400);
      throw new Error('Inspection does not belong to this property');
    }

    // Revoke any existing pending invitation for this email + inspection
    await Invitation.updateMany(
      { inspectionId, email, status: 'PENDING' },
      { status: 'REVOKED' }
    );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await Invitation.create({
      propertyId,
      inspectionId,
      inviterId: req.user._id,
      email,
      token,
      expiresAt,
    });

    // In production, send this link via email
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite?token=${token}`;

    res.status(201).json({ invitation, inviteLink });
  } catch (error) {
    next(error);
  }
};

export const resolveInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const { name, password } = req.body;

    const invitation = await Invitation.findOne({
      token,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    });

    if (!invitation) {
      res.status(400);
      throw new Error('Invalid or expired invitation token');
    }

    // Check if user already exists
    let user = await User.findOne({ email: invitation.email });

    if (!user) {
      // Create tenant — hash password before storing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = password ? await bcrypt.hash(password, salt) : undefined;

      user = await User.create({
        name,
        email: invitation.email,
        password: hashedPassword,
        role: 'Tenant',
      });
    }

    // Link tenant to inspection
    await Inspection.findByIdAndUpdate(invitation.inspectionId, { tenantId: user._id });

    invitation.status = 'ACCEPTED';
    await invitation.save();

    const jwtToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '30d' } as jwt.SignOptions
    );

    res.json({
      message: 'Invitation accepted',
      user: { _id: user._id, email: user.email, role: user.role, name: user.name },
      token: jwtToken,
      propertyId: invitation.propertyId,
      inspectionId: invitation.inspectionId,
    });
  } catch (error) {
    next(error);
  }
};
