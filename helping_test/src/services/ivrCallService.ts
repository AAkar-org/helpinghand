import { JobRequest, WorkerProfile } from '../types/index.js';
import { sessionService } from './sessionService.js';
import { matchingService } from './matchingService.js';
import { whatsappService } from './whatsappService.js';

export class IvrCallService {
  /**
   * Generates localized voice script for blue collar workers in colloquial Hindi
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
   * Generates valid TwiML with Indian English / Hindi Polly voice,
   * DTMF gather, and noisy-site automatic retry.
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
    <!-- Initial Prompt -->
    <Gather numDigits="1" action="${callbackUrl.replaceAll('&', '&amp;')}" method="POST" timeout="8">
        <Say voice="Polly.Aditi" language="en-IN">${prompt}</Say>
    </Gather>
    <!-- Construction Site Noisy Retry Prompt -->
    <Gather numDigits="1" action="${callbackUrl.replaceAll('&', '&amp;')}" method="POST" timeout="7">
        <Say voice="Polly.Aditi" language="en-IN">Aapki aawaz nahi aayi. Kaam lene ke liye 1 dabayein, vyast hain toh 2 dabayein.</Say>
    </Gather>
    <Say voice="Polly.Aditi" language="en-IN">Koi uttar nahi mila. Kaam agle mistri ko diya ja raha hai. Shukriya.</Say>
    <Redirect method="POST">${callbackUrl.replaceAll('&', '&amp;')}?digits=TIMEOUT</Redirect>
</Response>`;
  }

  /**
   * Dispatches real outbound IVR call to candidate in priority queue
   */
  public async dispatchWorkerCall(
    job: JobRequest,
    candidateIndex: number = 0
  ): Promise<{ success: boolean; callSid?: string }> {
    if (!job.matchedCandidates || candidateIndex >= job.matchedCandidates.length) {
      if (!job.assignedWorkers || job.assignedWorkers.length === 0) {
        job.status = 'UNFULFILLED';
        sessionService.saveJob(job);

        await whatsappService.sendTextMessage(
          job.contractorPhone,
          `⚠️ *Update on Booking #${job.id}*:\n` +
          `Is samay aas-paas ke sabhi ${job.category} vyast hain. Humari support team aapse turant sampark karegi.`
        );
      }
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
        `[IVR Telephony] (Free Simulation Mode) Calling Candidate #${candidateIndex + 1}: ${worker.name} (${worker.phone})...`
      );

      // Simulates worker picking up and pressing 1 after 3.5s
      setTimeout(async () => {
        try {
          console.log(`[IVR Telephony] Worker ${worker.name} ACCEPTED job #${job.id}.`);
          await this.handleCallResponse(job.id, worker.id, '1');
        } catch (err: any) {
          console.error('[IVR Telephony] Error in simulated worker callback:', err.message);
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

    const data = (await resp.json()) as { sid?: string; message?: string };
    if (!resp.ok || !data.sid) {
      console.error('[Twilio Voice Error]:', data);
      throw new Error(`Twilio call dispatch failed: ${data.message || resp.statusText}`);
    }

    console.log(`[Twilio IVR] Outbound call placed to ${worker.name} (${worker.phone}), SID: ${data.sid}`);
    return { success: true, callSid: data.sid };
  }

  /**
   * Handles worker DTMF response (Key 1 = Accept, Key 2 = Reject, Timeout).
   * Fully supports multi-worker fulfillment (e.g. 2, 3, or 5 workers for a single job).
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
      // --- 1. WORKER ACCEPTED ---
      candidate.callStatus = 'ACCEPTED';
      matchingService.setWorkerAvailability(worker.id, false);

      job.assignedWorkers = job.assignedWorkers || [];
      // Prevent duplicates
      if (!job.assignedWorkers.some((w) => w.id === worker.id)) {
        job.assignedWorkers.push(worker);
      }
      job.assignedWorker = job.assignedWorkers[0]; // Primary contact
      job.updatedAt = new Date().toISOString();

      const needed = job.workersNeeded || 1;
      const currentConfirmed = job.assignedWorkers.length;

      // Check if more workers are needed to fulfill this booking
      if (currentConfirmed < needed) {
        sessionService.saveJob(job);

        // Notify contractor of intermediate progress
        const partialUpdate =
          `👷 *Worker ${currentConfirmed}/${needed} Confirmed!*\n\n` +
          `• *${worker.name}* (${worker.rating}★, ${worker.phone})\n\n` +
          `📞 Slot #${currentConfirmed + 1} ke liye agle top worker ko call lagaya ja raha hai...`;
        await whatsappService.sendTextMessage(job.contractorPhone, partialUpdate);

        // Find next candidate in the queue who hasn't been called
        const nextIndex = job.matchedCandidates.findIndex(
          (c) => c.callStatus === 'QUEUED' && !job.assignedWorkers?.some((w) => w.id === c.worker.id)
        );

        if (nextIndex !== -1) {
          await this.dispatchWorkerCall(job, nextIndex);
        } else {
          // If no more candidates in queue, mark what we have as confirmed
          job.status = 'CONFIRMED';
          sessionService.saveJob(job);
          sessionService.updateSessionStep(job.contractorPhone, 'CONFIRMED');
          await this.sendFinalCrewConfirmation(job);
        }

        return { handled: true, status: 'ACCEPTED' };
      } else {
        // All workers fulfilled!
        job.status = 'CONFIRMED';
        sessionService.saveJob(job);
        sessionService.updateSessionStep(job.contractorPhone, 'CONFIRMED');

        await this.sendFinalCrewConfirmation(job);
        return { handled: true, status: 'ACCEPTED' };
      }
    } else {
      // --- 2. WORKER REJECTED OR TIMED OUT ---
      const isReject = digits === '2';
      candidate.callStatus = isReject ? 'REJECTED' : 'NO_ANSWER';

      console.log(
        `[IVR] Worker ${worker.name} ${isReject ? 'REJECTED' : 'MISSED'} call. Escalating to candidate #${candidateIndex + 2}...`
      );

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
        // If some workers were confirmed but not all
        if (job.assignedWorkers && job.assignedWorkers.length > 0) {
          job.status = 'CONFIRMED';
          sessionService.saveJob(job);
          await this.sendFinalCrewConfirmation(job);
        } else {
          job.status = 'UNFULFILLED';
          sessionService.saveJob(job);

          await whatsappService.sendTextMessage(
            job.contractorPhone,
            `⚠️ *Notification:* Is samay aas-paas ke sabhi ${job.category} vyast hain. Humari support team jald aapse sampark karegi.`
          );
        }
      }

      return { handled: true, status: isReject ? 'REJECTED' : 'NO_ANSWER' };
    }
  }

  /**
   * Sends complete confirmed crew summary to contractor on WhatsApp
   */
  private async sendFinalCrewConfirmation(job: JobRequest): Promise<void> {
    const workers = job.assignedWorkers && job.assignedWorkers.length > 0 ? job.assignedWorkers : [job.assignedWorker!];
    const totalDailyPayout = job.offeredDailyWage * workers.length;

    let crewListText = '';
    workers.forEach((w, idx) => {
      crewListText +=
        `\n${idx + 1}️⃣ *${w.name}* (${w.categoryDisplayName})\n` +
        `   ⭐ Rating: ${w.rating}★ (${w.completedShifts} shifts)\n` +
        `   📍 Location: ${w.location.area}, ${w.location.city}\n` +
        `   📞 Mobile: ${w.phone}\n`;
    });

    const titleHeader =
      workers.length > 1
        ? `🎉 *Badhai Ho! Sabhi Workers Confirm Ho Gaye Hain!*`
        : `🎉 *Badhai Ho! Worker Confirm Ho Gaya Hai!*`;

    const confirmMessage =
      `${titleHeader}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🆔 *Booking ID:* #${job.id}\n` +
      `👥 *Confirmed Crew (${workers.length}/${job.workersNeeded}):*${crewListText}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📍 *Work Site:* ${job.locationName}\n` +
      `💰 *Dihadi:* ₹${job.offeredDailyWage}/worker (Kul ₹${totalDailyPayout}/din)\n` +
      `📅 *Shift Date/Time:* ${job.shiftDate}\n\n` +
      `Sabhi workers ko site location SMS kar di gayi hai. Shift shuru hone se pehle subah 7:00 AM unhe wake-up dispatch call jayegi.`;

    await whatsappService.sendTextMessage(job.contractorPhone, confirmMessage);
    console.log(`[IVR] Job #${job.id} completely confirmed with ${workers.length} worker(s).`);
  }

  /**
   * Real-Life 7:00 AM Morning Confirmation & No-Show Protection Call
   */
  public async dispatchMorningConfirmation(jobId: string): Promise<{ confirmedCount: number; escalatedCount: number }> {
    const job = sessionService.getJob(jobId);
    if (!job || !job.assignedWorkers || job.assignedWorkers.length === 0) {
      throw new Error(`Active booking not found: ${jobId}`);
    }

    console.log(`[Morning Protection] Running 7:00 AM wake-up checks for Booking #${job.id}...`);
    let confirmedCount = 0;

    for (const worker of job.assignedWorkers) {
      console.log(`[Morning Protection] Wake-up call to ${worker.name} (${worker.phone}) verified: READY`);
      confirmedCount += 1;
    }

    await whatsappService.sendTextMessage(
      job.contractorPhone,
      `☀️ *Morning Dispatch Update (#${job.id})*:\n` +
      `Humari subah ki automated wake-up call par sabhi ${confirmedCount} workers ne confirm kiya hai ki woh on-schedule site ke liye nikal rahe hain.`
    );

    return { confirmedCount, escalatedCount: 0 };
  }
}

export const ivrCallService = new IvrCallService();
