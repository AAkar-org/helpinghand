import { JobRequest, WorkerProfile } from '../types/index.js';
import { sessionService } from './sessionService.js';
import { matchingService } from './matchingService.js';
import { whatsappService } from './whatsappService.js';

export class IvrCallService {
  /**
   * Generates localized voice script for blue collar workers in Hindi
   */
  public generateCallScript(worker: WorkerProfile, job: JobRequest): string {
    return (
      `Namaste ${worker.name}. Helping Hand se urgent kaam ka offer hai. ` +
      `Kaam: ${worker.categoryHindi} (${job.category}). ` +
      `Site: ${job.locationName}. ` +
      `Dihadi: ${job.offeredDailyWage} rupaye prati din. ` +
      `Kaam ki tarikh: ${job.shiftDate}. ` +
      `Agar aap kaam par aana chahte hain toh 1 dabayein. Agar busy hain toh 2 dabayein.`
    );
  }

  /**
   * Generates valid TwiML with Indian English / Hindi voice and DTMF gather
   */
  public generateTwiml(
    worker: WorkerProfile,
    job: JobRequest,
    callbackBaseUrl: string
  ): string {
    const prompt = this.generateCallScript(worker, job);
    const callbackUrl = `${callbackBaseUrl}/api/calls/callback?bookingId=${job.id}&workerId=${worker.id}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Gather numDigits="1" action="${callbackUrl.replaceAll('&', '&amp;')}" method="POST" timeout="10">
        <Say voice="Polly.Aditi" language="en-IN">${prompt}</Say>
    </Gather>
    <Say voice="Polly.Aditi" language="en-IN">Aapne koi button nahi dabaya. Kaam doosre mistri ko diya ja raha hai. Shukriya.</Say>
    <Redirect method="POST">${callbackUrl.replaceAll('&', '&amp;')}?digits=TIMEOUT</Redirect>
</Response>`;
  }

  /**
   * Dispatches real outbound IVR call to top candidate via Twilio
   */
  public async dispatchWorkerCall(
    job: JobRequest,
    candidateIndex: number = 0
  ): Promise<{ success: boolean; callSid?: string }> {
    if (!job.matchedCandidates || candidateIndex >= job.matchedCandidates.length) {
      job.status = 'UNFULFILLED';
      sessionService.saveJob(job);

      await whatsappService.sendTextMessage(
        job.contractorPhone,
        `⚠️ *Update on Booking #${job.id}*:\n` +
        `Is samay sabhi ${job.category} vyast hain. Humari support team aapse jald sampark karegi.`
      );

      throw new Error('No more available candidates in priority queue');
    }

    const match = job.matchedCandidates[candidateIndex];
    const worker = match.worker;

    match.callStatus = 'CALLING';
    match.callAttemptCount += 1;
    match.lastCallTimestamp = new Date().toISOString();
    job.status = 'CALLING';
    sessionService.saveJob(job);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    const callbackBase = process.env.TWILIO_CALLBACK_BASE_URL;

    if (!accountSid || !authToken || !fromNumber || !callbackBase) {
      console.log(
        `[IVR Telephony] Twilio credentials not configured in .env. Simulating outbound call to Worker: ${worker.name} (${worker.phone})...`
      );

      // Simulate worker answering and pressing [1] (Accept) after 3.5 seconds to complete WhatsApp flow
      setTimeout(async () => {
        try {
          console.log(`[IVR Telephony] Worker ${worker.name} confirmed job. Sending instant WhatsApp confirmation to contractor...`);
          await this.handleCallResponse(job.id, worker.id, '1');
        } catch (err) {
          console.error('[IVR Telephony] Error in simulated worker callback:', err);
        }
      }, 3500);

      return { success: true, callSid: `SIM_${Date.now()}` };
    }

    const twiml = this.generateTwiml(worker, job, callbackBase);
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const bodyParams = new URLSearchParams({
      To: worker.phone,
      From: fromNumber,
      Twiml: twiml
    });

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: bodyParams.toString()
    });

    const data = await resp.json() as { sid?: string; message?: string };
    if (!resp.ok || !data.sid) {
      console.error('[Twilio Voice Error]:', data);
      throw new Error(`Twilio call dispatch failed: ${data.message || resp.statusText}`);
    }

    console.log(`[Twilio IVR] Outbound call placed to ${worker.name} (${worker.phone}), Call SID: ${data.sid}`);
    return { success: true, callSid: data.sid };
  }

  /**
   * Handles worker DTMF response (Key 1 = Accept, Key 2 = Reject, Timeout)
   */
  public async handleCallResponse(
    bookingId: string,
    workerId: string,
    digits: string
  ): Promise<{ handled: boolean; status: 'ACCEPTED' | 'REJECTED' | 'NO_ANSWER' }> {
    const job = sessionService.getJob(bookingId);
    if (!job) {
      console.error(`[IVR] Job not found for callback: ${bookingId}`);
      return { handled: false, status: 'NO_ANSWER' };
    }

    const candidateIndex = job.matchedCandidates.findIndex((c) => c.worker.id === workerId);
    if (candidateIndex === -1) {
      console.error(`[IVR] Candidate worker ${workerId} not found in job ${bookingId}`);
      return { handled: false, status: 'NO_ANSWER' };
    }

    const candidate = job.matchedCandidates[candidateIndex];
    const worker = candidate.worker;

    if (digits === '1') {
      // WORKER ACCEPTED
      candidate.callStatus = 'ACCEPTED';
      job.status = 'CONFIRMED';
      job.assignedWorker = worker;
      job.updatedAt = new Date().toISOString();

      matchingService.setWorkerAvailability(worker.id, false);
      sessionService.saveJob(job);
      sessionService.updateSessionStep(job.contractorPhone, 'CONFIRMED');

      const confirmMessage =
        `🎉 *Badhai Ho! Worker Confirm Ho Gaya Hai!*\n\n` +
        `👷 *Worker:* ${worker.name} (${worker.categoryDisplayName})\n` +
        `⭐ *Rating:* ${worker.rating}★ (${worker.completedShifts} shifts completed)\n` +
        `📍 *Location:* ${worker.location.area} (~${candidate.distanceKm} km door)\n` +
        `📞 *Direct Mobile Number:* ${worker.phone}\n` +
        `💰 *Agreed Dihadi:* ₹${job.offeredDailyWage}/day\n` +
        `📅 *Shift Date/Time:* ${job.shiftDate}\n\n` +
        `Worker ko site location & timing SMS kar diye gaye hain. Kisi bhi sahayata ke liye aap is number par reply kar sakte hain.`;

      await whatsappService.sendTextMessage(job.contractorPhone, confirmMessage);
      console.log(`[IVR] Worker ${worker.name} ACCEPTED job #${job.id}. Contractor notified on WhatsApp.`);

      return { handled: true, status: 'ACCEPTED' };
    } else {
      // WORKER REJECTED OR TIMED OUT
      const isReject = digits === '2';
      candidate.callStatus = isReject ? 'REJECTED' : 'NO_ANSWER';

      console.log(`[IVR] Worker ${worker.name} ${isReject ? 'REJECTED' : 'MISSED'} call. Escalating to candidate #${candidateIndex + 2}...`);

      const nextIndex = candidateIndex + 1;
      if (nextIndex < job.matchedCandidates.length) {
        const nextWorker = job.matchedCandidates[nextIndex].worker;
        await whatsappService.sendTextMessage(
          job.contractorPhone,
          `🔄 *Update:* Worker ${worker.name} is samay vyast hain.\n` +
          `Hum agle top-rated worker *${nextWorker.name}* (${nextWorker.rating}★, ${job.matchedCandidates[nextIndex].distanceKm} km door) ko call laga rahe hain... 📞`
        );

        await this.dispatchWorkerCall(job, nextIndex);
      } else {
        job.status = 'UNFULFILLED';
        sessionService.saveJob(job);

        await whatsappService.sendTextMessage(
          job.contractorPhone,
          `⚠️ *Notification:* Is samay aas-paas ke sabhi ${job.category} vyast hain. Humari support team jald aapse sampark karegi.`
        );
      }

      return { handled: true, status: isReject ? 'REJECTED' : 'NO_ANSWER' };
    }
  }
}

export const ivrCallService = new IvrCallService();
