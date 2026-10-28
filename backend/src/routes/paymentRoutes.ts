import express from 'express';
import {
  initializeEvidencePayment,
  verifyEvidencePayment,
  getEvidencePaymentStatus,
  handlePaystackWebhook,
} from '../controllers/paymentController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// Step 1: Frontend initializes Paystack checkout (amount: ₦5,000)
router.post('/initialize', protect, initializeEvidencePayment);

// Step 2: Frontend verifies payment after Paystack redirect or inline popup completion
router.get('/verify/:reference', protect, verifyEvidencePayment);

// Step 3: Check whether evidence download is unlocked for this inspection
router.get('/status/:inspectionId', protect, getEvidencePaymentStatus);

// Paystack asynchronous event webhook
router.post('/webhook', handlePaystackWebhook);

export default router;
