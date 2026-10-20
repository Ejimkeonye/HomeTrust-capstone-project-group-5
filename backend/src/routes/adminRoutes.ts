import express from 'express';
import { requireAdminKey, getAdminStats } from '../controllers/adminController';

const router = express.Router();

router.get('/stats', requireAdminKey, getAdminStats);

export default router;
