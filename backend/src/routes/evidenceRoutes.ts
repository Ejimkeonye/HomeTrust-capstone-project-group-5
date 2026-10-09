import express from 'express';
import { getPresignedUrl, confirmUpload } from '../controllers/evidenceController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// POST /api/evidence/presigned-url
// Step 1: Frontend requests a temporary S3 upload URL from the Lambda via this proxy.
// Body: { file_name: string, content_type: string }
// Returns: { upload_url: string, object_key: string, expires_in: number }
router.post('/presigned-url', protect, getPresignedUrl);

// POST /api/evidence/:inspectionId/items/:itemId/confirm
// Step 2: After the frontend uploads the file directly to S3, it calls this endpoint
// with the object_key so the backend can save the permanent S3 URL to DynamoDB.
// Body: { object_key: string, content_type: string }
router.post('/:inspectionId/items/:itemId/confirm', protect, confirmUpload);

export default router;
