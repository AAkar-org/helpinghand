import { Request, Response } from 'express';
import { ivrCallService } from '../services/ivrCallService.js';

export class CallController {
  /**
   * Twilio IVR Telephony Callback Endpoint (POST /api/calls/callback)
   * Receives worker DTMF keypress (1 = Accept, 2 = Decline)
   */
  public handleCallCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const bookingId = (req.query.bookingId as string) || req.body.bookingId;
      const workerId = (req.query.workerId as string) || req.body.workerId;
      const digits = (req.body.Digits as string) || (req.query.digits as string) || '';

      console.log(`[Twilio IVR Callback] Job #${bookingId}, Worker: ${workerId}, Keypress Digits: [${digits}]`);

      await ivrCallService.handleCallResponse(bookingId, workerId, digits);

      let responseSpeech = '';
      if (digits === '1') {
        responseSpeech = 'Aapka kaam confirm ho gaya hai. SMS ke dwara aapko site ki details bhej di gayi hain. Shukriya.';
      } else {
        responseSpeech = 'Dhanyawaad. Agle kaam ke liye hum aapse sampark karenge.';
      }

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi" language="en-IN">${responseSpeech}</Say>
    <Hangup/>
</Response>`;

      res.set('Content-Type', 'text/xml');
      res.status(200).send(twiml);
    } catch (err) {
      console.error('[Call Controller] Error in IVR callback:', err);
      res.set('Content-Type', 'text/xml');
      res.status(500).send('<Response><Hangup/></Response>');
    }
  };
}

export const callController = new CallController();
