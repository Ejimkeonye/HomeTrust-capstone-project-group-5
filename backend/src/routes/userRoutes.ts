import express from 'express';
import { getMyProfile, updateMyProfile } from '../controllers/userController';
import { protect } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/me', protect, getMyProfile);
router.patch('/me', protect, updateMyProfile);

export default router;