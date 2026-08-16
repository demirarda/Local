import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import authRouter from './api/auth.js';
import projectsRouter from './api/projects.js';
import tasksRouter from './api/tasks.js';
import bridgeRouter from './api/bridge.js';
import importRouter from './api/import.js';
import hostsRouter from './api/hosts.js';
import venuesPipelineRouter from './api/venuesPipeline.js';
import screensRouter from './api/screens.js';
import dashboardRouter from './api/dashboard.js';
import nominationsRouter from './api/nominations.js';
import eventGroupsRouter from './api/eventGroups.js';
import { UPLOADS_DIR } from './middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'local-ops-api', version: '1.0.0' });
});

app.use('/api/ops/auth', authRouter);
app.use('/api/ops/projects', projectsRouter);
app.use('/api/ops/tasks', tasksRouter);
app.use('/api/ops/bridge', bridgeRouter);
app.use('/api/ops/import', importRouter);
app.use('/api/ops/hosts', hostsRouter);
app.use('/api/ops/venues-pipeline', venuesPipelineRouter);
app.use('/api/ops/screens', screensRouter);
app.use('/api/ops/dashboard', dashboardRouter);
app.use('/api/ops/nominations', nominationsRouter);
app.use('/api/ops/event-groups', eventGroupsRouter);
app.use('/api/ops/uploads', express.static(UPLOADS_DIR));

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LOCAL Ops API running on http://localhost:${PORT}`);
});
