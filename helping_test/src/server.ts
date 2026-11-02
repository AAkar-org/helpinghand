import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { webhookController } from './controllers/webhookController.js';
import { callController } from './controllers/callController.js';
import { apiController } from './controllers/apiController.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'helping-hand-meta-whatsapp-engine',
    timestamp: new Date().toISOString()
  });
});

// 1. Meta WhatsApp Cloud API Webhooks
app.get('/webhook', webhookController.handleMetaVerify);
app.post('/webhook', webhookController.handleMetaWebhook);

// 2. Twilio IVR Telephony Callback
app.post('/api/calls/callback', callController.handleCallCallback);

// 3. Operational Monitoring & Wage Intelligence Endpoints
app.get('/api/workers', apiController.getWorkers);
app.get('/api/jobs', apiController.getJobs);
app.get('/api/sessions', apiController.getSessions);
app.get('/api/wages', apiController.getWageBenchmarks);
app.post('/api/jobs/:jobId/morning-check', apiController.triggerMorningConfirmation);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`
===============================================================
  🚀 HELPING HAND - META WHATSAPP AUTOMATION ENGINE ONLINE
===============================================================
  📡 Server running at: http://localhost:${PORT}
  
  [Production Webhooks Ready]:
  - Meta Webhook (GET / POST):   http://localhost:${PORT}/webhook
  - Twilio Voice Callback (POST): http://localhost:${PORT}/api/calls/callback
  
  [Monitoring Endpoints]:
  - Health check:                http://localhost:${PORT}/health
  - Active Jobs:                 http://localhost:${PORT}/api/jobs
  - Worker Pool:                 http://localhost:${PORT}/api/workers
===============================================================
    `);
  });
}

export default app;
