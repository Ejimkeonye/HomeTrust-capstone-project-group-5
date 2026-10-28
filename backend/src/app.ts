import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import authRoutes from './routes/authRoutes';
import propertyRoutes from './routes/propertyRoutes';
import inspectionRoutes from './routes/inspectionRoutes';
import evidenceRoutes from './routes/evidenceRoutes';
import invitationRoutes from './routes/invitationRoutes';
import userRoutes from './routes/userRoutes';
import adminRoutes from './routes/adminRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { errorHandler } from './middlewares/errorMiddleware';

const app = express();

app.use(cors());
app.use(
  express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);



// Root status endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'HomeTrust Backend API is running', healthCheck: '/api/health' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// ─── Serve Frontend in Production (if bundled together) ───────────────────────
// If frontend is deployed separately, this will safely skip without throwing ENOENT.
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../dist');
  if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
    app.use(express.static(frontendPath));

    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
}

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
