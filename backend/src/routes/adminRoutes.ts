import express from 'express';
import { requireAdminKey, getAdminStats, getAdminUsers } from '../controllers/adminController';

const router = express.Router();

router.get('/stats', requireAdminKey, getAdminStats);
router.get('/users', requireAdminKey, getAdminUsers);

export default router;
