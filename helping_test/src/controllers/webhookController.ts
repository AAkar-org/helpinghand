import { Request, Response } from 'express';
import { workflowEngine } from '../services/workflowEngine.js';

export class WebhookController {
  private processedMessageIds: Map<string, number> = new Map();
  private readonly DEDUP_TTL_MS = 120_000; // 120 seconds idempotency cache

  /**
   * Deduplicates Meta retry webhooks using message ID (wamid)
   */
  public isDuplicateMessage(messageId?: string): boolean {
    if (!messageId) return false;
    const now = Date.now();

    // Evict expired entries
    for (const [id, timestamp] of this.processedMessageIds.entries()) {
      if (now - timestamp > this.DEDUP_TTL_MS) {
        this.processedMessageIds.delete(id);
      }
    }

    if (this.processedMessageIds.has(messageId)) {
      return true;
    }

    this.processedMessageIds.set(messageId, now);
    return false;
  }

  /**
   * Meta WhatsApp Cloud API Webhook Verification (GET /webhook)
   */
  public handleMetaVerify = (req: Request, res: Response): void => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!expectedToken) {
      console.error('[Meta Webhook] WHATSAPP_VERIFY_TOKEN is not configured in .env');
      res.status(500).send('WHATSAPP_VERIFY_TOKEN not set on server');
      return;
    }

    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[Meta Webhook] Webhook verified successfully by Meta.');
      res.status(200).send(challenge);
    } else {
      console.warn(`[Meta Webhook] Verification failed. Received token: "${token}"`);
      res.status(403).send('Forbidden');
    }
  };

  /**
   * Meta WhatsApp Cloud API Incoming Event Delivery (POST /webhook)
   */
  public handleMetaWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body;

      // Meta sends events wrapped in entry[].changes[].value
      if (body.object === 'whatsapp_business_account') {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const messages = value?.messages;

        if (messages && messages.length > 0) {
          const message = messages[0];
          const senderPhone = message.from; // e.g. "919876543210"

          // Deduplication: prevent duplicate processing on Meta retry
          if (message.id && this.isDuplicateMessage(message.id)) {
            console.log(`[Meta Webhook] Dropping duplicate webhook delivery: ${message.id}`);
            res.status(200).send('EVENT_RECEIVED');
            return;
          }

          let messageText = '';
          let incomingLoc: { lat: number; lng: number; name?: string } | undefined;

          if (message.type === 'text') {
            messageText = message.text?.body || '';
          } else if (message.type === 'location') {
            const loc = message.location;
            incomingLoc = {
              lat: loc.latitude,
              lng: loc.longitude,
              name: loc.name || loc.address || `GPS (${loc.latitude}, ${loc.longitude})`
            };
            messageText = `Location: ${loc.latitude}, ${loc.longitude}`;
          } else if (message.type === 'interactive') {
            const reply = message.interactive?.button_reply || message.interactive?.list_reply;
            messageText = reply?.id || reply?.title || '';
          }

          if (messageText || incomingLoc) {
            console.log(`[Meta Webhook] Inbound from ${senderPhone}: "${messageText}"`);
            await workflowEngine.handleIncomingMessage(senderPhone, messageText, incomingLoc);
          }
        }
      }

      // Always return 200 OK to Meta so they do not retry delivery
      res.status(200).send('EVENT_RECEIVED');
    } catch (err) {
      console.error('[Meta Webhook] Processing error:', err);
      res.status(500).send('Error');
    }
  };
}

export const webhookController = new WebhookController();
