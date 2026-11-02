export interface MetaSendMessageResult {
  messagingProduct: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export class WhatsAppService {
  /**
   * Normalizes to standard E.164 format (+91 for India if 10-digit number)
   */
  public formatE164(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
  }

  /**
   * Sends text message to contractor via official Meta WhatsApp Cloud API
   */
  public async sendTextMessage(toPhone: string, text: string): Promise<string> {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      const err = new Error(
        'Meta WhatsApp API credentials missing. Please set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your .env file.'
      );
      console.error(err.message);
      throw err;
    }

    const formattedTo = this.formatE164(toPhone);
    const recipient = formattedTo.replace('+', '');
    const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error('[Meta WhatsApp API Error]:', JSON.stringify(data, null, 2));
      throw new Error(`Meta WhatsApp send failed (${response.status}): ${data.error?.message || response.statusText}`);
    }

    const metaMsgId = data.messages?.[0]?.id || 'unknown';
    console.log(`[Meta WhatsApp] Outbound message delivered to ${formattedTo} (Meta Msg ID: ${metaMsgId})`);
    return metaMsgId;
  }
}

export const whatsappService = new WhatsAppService();
