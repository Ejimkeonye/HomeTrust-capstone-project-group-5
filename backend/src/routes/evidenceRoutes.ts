import express from 'express';
import { getPresignedUrl, confirmUpload, getEvidenceDownloadUrl } from '../controllers/evidenceController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

// POST /api/evidence/presigned-url
// Step 1: Frontend requests a temporary S3 upload URL from the Lambda via this proxy.
// Body: { file_name, content_type, inspection_id, item_id }
// Returns: { upload_url: string, object_key: string, expires_in: number }
router.post('/presigned-url', protect, getPresignedUrl);
router.get('/:inspectionId/:evidenceId/download-url', protect, getEvidenceDownloadUrl);

// POST /api/evidence/:inspectionId/items/:itemId/confirm
// Step 2: After the frontend uploads the file directly to S3, it calls this endpoint
// with the object_key so the backend can save the private object reference to DynamoDB.
// Body: { object_key: string, content_type: string }
router.post('/:inspectionId/items/:itemId/confirm', protect, confirmUpload);

export default router;
