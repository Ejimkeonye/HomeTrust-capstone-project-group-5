import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/authRoutes';
import propertyRoutes from './routes/propertyRoutes';
import inspectionRoutes from './routes/inspectionRoutes';
import evidenceRoutes from './routes/evidenceRoutes';
import invitationRoutes from './routes/invitationRoutes';
import { errorHandler } from './middlewares/errorMiddleware';

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/invitations', invitationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
