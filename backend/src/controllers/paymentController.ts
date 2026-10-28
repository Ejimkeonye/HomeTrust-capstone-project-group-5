import { Request, Response, NextFunction } from 'express';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../config/dynamodb';
import { AuthRequest } from '../middlewares/authMiddleware';
import { IInspection, IPayment } from '../types';
import { writeAuditEvent } from '../utils/auditLogger';
import {
  EVIDENCE_ACCESS_FEE_NGN,
  EVIDENCE_ACCESS_FEE_KOBO,
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyWebhookSignature,
  isPaystackConfigured,
} from '../utils/paystack';

function canAccessInspection(inspection: IInspection, userId: string): boolean {
  return (
    inspection.landlordId === userId ||
    inspection.tenantId === userId ||
    inspection.createdBy === userId ||
    inspection.participantIds?.includes(userId) === true
  );
}

/**
 * POST /api/payments/initialize
 * Prompts user to pay ₦5,000 via Paystack before downloading move-in evidence.
 */
export const initializeEvidencePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { inspectionId, callbackUrl } = req.body;

    if (!inspectionId || typeof inspectionId !== 'string') {
      return res.status(400).json({ message: 'inspectionId is required' });
    }

    const inspResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
      }),
    );

    const inspection = inspResult.Item as IInspection | undefined;
    if (!inspection) {
      return res.status(404).json({ message: 'Inspection not found' });
    }

    const userId = req.user!.userId;
    if (!canAccessInspection(inspection, userId)) {
      return res.status(403).json({ message: 'Not authorized for this inspection' });
    }

    // If evidence access is already unlocked for this inspection
    if (inspection.isEvidencePaid) {
      return res.status(200).json({
        alreadyPaid: true,
        message: 'Move-in evidence access is already unlocked for this inspection',
        inspectionId,
        paymentReference: inspection.paymentReference,
        paidAt: inspection.paidAt,
      });
    }

    const safeId = inspectionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
    const reference = `HT_MOVEIN_${safeId}_${Date.now()}`;
    const userEmail = req.user!.email;

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const defaultCallback = `${frontendBase.replace(/\/+$/, '')}/inspections/${inspectionId}/report?payment_ref=${encodeURIComponent(reference)}`;
    const effectiveCallback = callbackUrl && typeof callbackUrl === 'string' ? callbackUrl : defaultCallback;

    const initResult = await initializePaystackTransaction({
      email: userEmail,
      amountKobo: EVIDENCE_ACCESS_FEE_KOBO,
      reference,
      callbackUrl: effectiveCallback,
      metadata: {
        inspectionId,
        propertyId: inspection.propertyId,
        userId,
        email: userEmail,
        purpose: 'move_in_evidence_access',
      },
    });

    const now = new Date().toISOString();
    const paymentRecord: IPayment = {
      reference,
      inspectionId,
      userId,
      email: userEmail,
      amount: EVIDENCE_ACCESS_FEE_NGN,
      amountInKobo: EVIDENCE_ACCESS_FEE_KOBO,
      currency: 'NGN',
      status: 'PENDING',
      metadata: {
        propertyId: inspection.propertyId,
        isMock: initResult.isMock,
      },
      createdAt: now,
      updatedAt: now,
    };

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLES.PAYMENTS,
          Item: paymentRecord,
        }),
      );
    } catch (dbErr) {
      console.warn('[Payments] Could not record initial payment in PAYMENTS table:', dbErr);
    }

    writeAuditEvent({
      eventType: 'payment.initialized',
      outcome: 'success',
      actorId: userId,
      resourceType: 'inspection',
      resourceId: inspectionId,
      details: { reference, amount: EVIDENCE_ACCESS_FEE_NGN, isMock: Boolean(initResult.isMock) },
    });

    return res.status(200).json({
      message: 'Payment initialized successfully',
      authorizationUrl: initResult.authorizationUrl,
      accessCode: initResult.accessCode,
      reference,
      amount: EVIDENCE_ACCESS_FEE_NGN,
      currency: 'NGN',
      isMock: initResult.isMock,
      isPaystackConfigured: isPaystackConfigured(),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/payments/verify/:reference
 * Verifies Paystack transaction and unlocks evidence download for the inspection.
 */
export const verifyEvidencePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { reference } = req.params;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ message: 'Payment reference is required' });
    }

    const verifyResult = await verifyPaystackTransaction(reference);

    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed or insufficient amount paid',
        gatewayResponse: verifyResult.gatewayResponse,
      });
    }

    // Try finding the payment record in DynamoDB
    let inspectionId = (verifyResult.metadata?.inspectionId as string) || '';

    try {
      const paymentItem = await docClient.send(
        new GetCommand({
          TableName: TABLES.PAYMENTS,
          Key: { reference },
        }),
      );
      if (paymentItem.Item?.inspectionId) {
        inspectionId = paymentItem.Item.inspectionId;
      }
    } catch (err) {
      console.warn('[Payments] Could not load payment record from DynamoDB:', err);
    }

    // Fallback: extract inspection ID from reference pattern HT_MOVEIN_<id>_<timestamp>
    if (!inspectionId && reference.startsWith('HT_MOVEIN_')) {
      const parts = reference.split('_');
      if (parts[2]) {
        inspectionId = parts[2];
      }
    }

    const now = new Date().toISOString();
    const userId = req.user!.userId;

    // 1. Update Payments table
    try {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.PAYMENTS,
          Key: { reference },
          UpdateExpression: 'SET #status = :status, paidAt = :paidAt, channel = :channel, updatedAt = :updatedAt',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':status': 'SUCCESS',
            ':paidAt': verifyResult.paidAt || now,
            ':channel': verifyResult.channel || 'unknown',
            ':updatedAt': now,
          },
        }),
      );
    } catch (dbErr) {
      console.warn('[Payments] Update payment record warning:', dbErr);
    }

    // 2. Unlock the inspection record so evidence & reports can be downloaded
    if (inspectionId) {
      try {
        await docClient.send(
          new UpdateCommand({
            TableName: TABLES.INSPECTIONS,
            Key: { inspectionId },
            UpdateExpression:
              'SET isEvidencePaid = :true, paymentReference = :ref, paidAt = :paidAt, paidBy = :paidBy, paymentAmount = :amount, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':true': true,
              ':ref': reference,
              ':paidAt': verifyResult.paidAt || now,
              ':paidBy': userId,
              ':amount': EVIDENCE_ACCESS_FEE_NGN,
              ':updatedAt': now,
            },
          }),
        );
      } catch (inspErr) {
        console.error('[Payments] Failed to unlock inspection evidence access:', inspErr);
        throw new Error('Payment was verified but failed to update inspection record');
      }
    }

    writeAuditEvent({
      eventType: 'payment.verified',
      outcome: 'success',
      actorId: userId,
      resourceType: 'inspection',
      resourceId: inspectionId,
      details: { reference, amount: EVIDENCE_ACCESS_FEE_NGN },
    });

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully. Move-in evidence access unlocked.',
      reference,
      inspectionId,
      amount: EVIDENCE_ACCESS_FEE_NGN,
      currency: 'NGN',
      paidAt: verifyResult.paidAt || now,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/payments/status/:inspectionId
 * Checks whether evidence download payment has been completed for an inspection.
 */
export const getEvidencePaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { inspectionId } = req.params;

    const inspResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.INSPECTIONS,
        Key: { inspectionId },
      }),
    );

    const inspection = inspResult.Item as IInspection | undefined;
    if (!inspection) {
      return res.status(404).json({ message: 'Inspection not found' });
    }

    const userId = req.user!.userId;
    if (!canAccessInspection(inspection, userId)) {
      return res.status(403).json({ message: 'Not authorized for this inspection' });
    }

    const isPaid = Boolean(inspection.isEvidencePaid);

    return res.status(200).json({
      inspectionId,
      isPaid,
      amount: EVIDENCE_ACCESS_FEE_NGN,
      currency: 'NGN',
      paymentReference: inspection.paymentReference,
      paidAt: inspection.paidAt,
      paidBy: inspection.paidBy,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/payments/webhook
 * Receives Paystack webhook notifications and verifies signatures.
 */
export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-paystack-signature'] || '') as string;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn('[Paystack Webhook] Invalid signature received');
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body;
    if (event?.event === 'charge.success') {
      const data = event.data;
      const reference = data?.reference;
      const amountKobo = data?.amount || 0;
      const inspectionId = data?.metadata?.inspectionId;
      const userId = data?.metadata?.userId || 'paystack_webhook';

      if (reference && amountKobo >= EVIDENCE_ACCESS_FEE_KOBO && inspectionId) {
        const now = new Date().toISOString();

        await docClient.send(
          new UpdateCommand({
            TableName: TABLES.INSPECTIONS,
            Key: { inspectionId },
            UpdateExpression:
              'SET isEvidencePaid = :true, paymentReference = :ref, paidAt = :paidAt, paidBy = :paidBy, paymentAmount = :amount, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
              ':true': true,
              ':ref': reference,
              ':paidAt': data.paid_at || now,
              ':paidBy': userId,
              ':amount': EVIDENCE_ACCESS_FEE_NGN,
              ':updatedAt': now,
            },
          }),
        );

        writeAuditEvent({
          eventType: 'payment.webhook_success',
          outcome: 'success',
          actorId: userId,
          resourceType: 'inspection',
          resourceId: inspectionId,
          details: { reference, amount: EVIDENCE_ACCESS_FEE_NGN },
        });
      }
    }

    return res.status(200).json({ status: true });
  } catch (err) {
    console.error('[Paystack Webhook] Error processing webhook:', err);
    return res.status(500).json({ message: 'Webhook processing error' });
  }
};
