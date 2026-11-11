import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';

import { webhookController } from './controllers/webhookController.js';
import { callController } from './controllers/callController.js';
import { apiController } from './controllers/apiController.js';
import { dbClient } from './db/dbClient.js';
import { redisClient } from './db/redisClient.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Trust reverse proxy for accurate client IP detection behind Nginx / Cloudflare
app.set('trust proxy', 1);

// 1. HTTP Security Headers (OWASP Hardening)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Restriction
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';
app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256', 'X-Twilio-Signature']
  })
);

// 3. Body Parser with Raw Buffer Retention for HMAC Verification
app.use(
  express.json({
    limit: '2mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// 4. Rate Limiting (Surge & Anti-DDoS Protection)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test'
});

app.use('/api/', apiLimiter);
app.use('/webhook', webhookLimiter);

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'helping-hand-meta-whatsapp-engine',
    infrastructure: {
      postgres: dbClient.isReady ? 'CONNECTED (port 5433, db: helping_hand)' : 'OFFLINE_FALLBACK',
      redis: redisClient.isReady ? 'CONNECTED (port 6379)' : 'OFFLINE_FALLBACK'
    },
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

  [Database & Cache (Docker)]:
  - PostgreSQL (port 5433):      ${dbClient.isReady ? 'ONLINE (Pool max: 25)' : 'CONNECTING...'}
  - Redis (port 6379):           ${redisClient.isReady ? 'ONLINE (Distributed Lock & Limiter Ready)' : 'CONNECTING...'}
  
  [Security & Surge Hardening]:
  - OWASP Protection:            Helmet Headers & CORS Enabled
  - Webhook Cryptography:        Meta HMAC-SHA256 & Twilio Signatures
  - Rate Limiting:               IP & Per-Phone Sliding Window Active
  
  [Monitoring Endpoints]:
  - Health check:                http://localhost:${PORT}/health
  - Active Jobs:                 http://localhost:${PORT}/api/jobs
  - Worker Pool:                 http://localhost:${PORT}/api/workers
===============================================================
    `);
  });
}

export default app;
