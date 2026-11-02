import { JobRequest, WorkerCategory } from '../types/index.js';
import { sessionService } from './sessionService.js';
import { matchingService } from './matchingService.js';
import { ivrCallService } from './ivrCallService.js';
import { whatsappService } from './whatsappService.js';
import { resolveLocationCoordinates } from '../data/locations.js';
import { nlpParser } from './nlpParser.js';
import { wageBenchmarkService } from './wageBenchmarkService.js';

export class WorkflowEngine {
  /**
   * Main entry point for processing incoming WhatsApp messages from contractors
   */
  public async handleIncomingMessage(
    senderPhone: string,
    messageText: string,
    incomingLocation?: { lat: number; lng: number; name?: string }
  ): Promise<{ replyText: string; job?: JobRequest }> {
    const session = sessionService.getOrCreateSession(senderPhone);
    const cleanedText = messageText.trim();
    const lowerText = cleanedText.toLowerCase();

    // Universal Reset Commands
    if (['reset', 'cancel', 'start over', 'menu', 'restart'].includes(lowerText)) {
      sessionService.resetSession(senderPhone);
      const reply =
        `🔄 *Session Reset Ho Gaya Hai.*\n\n` +
        `Nayi worker inquiry ke liye *Hi* ya apna kaam likh kar bhejein (Jaise: *"Kal subah Sector 62 me 2 Mistri chahiye 900 dihadi"*).`;
      await whatsappService.sendTextMessage(senderPhone, reply);
      return { replyText: reply };
    }

    // -------------------------------------------------------------
    // REALISTIC FEATURE #1: SMART "ONE-SHOT" NATURAL LANGUAGE PARSER
    // If user sends a rich instruction upfront, parse all fields at once!
    // -------------------------------------------------------------
    if (session.step === 'IDLE' || session.step === 'AWAITING_WORK_DESCRIPTION') {
      const parsed = nlpParser.parseOneShotMessage(cleanedText);

      // If user provided a comprehensive request in a single message
      if (parsed.isComprehensive && parsed.category && parsed.workersNeeded && parsed.locationName && parsed.offeredDailyWage && parsed.shiftDate) {
        console.log(`[Workflow NLP] One-shot comprehensive booking detected from ${senderPhone}!`);

        const coords = await resolveLocationCoordinates(parsed.locationName);
        if (coords) {
          sessionService.updateJobDraft(senderPhone, {
            contractorPhone: session.phone,
            workDescription: cleanedText,
            category: parsed.category,
            workersNeeded: parsed.workersNeeded,
            locationName: coords.name,
            coordinates: coords,
            offeredDailyWage: parsed.offeredDailyWage,
            shiftDate: parsed.shiftDate,
            createdAt: new Date().toISOString()
          });

          return await this.renderBookingSummaryAndAwaitingConfirm(senderPhone);
        }
      }

      // If partially comprehensive (e.g. specified category and count, or category and location)
      if (parsed.category) {
        sessionService.updateJobDraft(senderPhone, {
          contractorPhone: session.phone,
          workDescription: cleanedText,
          category: parsed.category,
          createdAt: new Date().toISOString()
        });

        if (parsed.workersNeeded) {
          sessionService.updateJobDraft(senderPhone, { workersNeeded: parsed.workersNeeded });
        } else {
          sessionService.updateSessionStep(senderPhone, 'AWAITING_WORKER_COUNT');
          const reply =
            `✅ Category: *${parsed.category}* note kar li gayi hai.\n\n` +
            `Aapko kitne worker chahiye? (e.g. *1*, *2*, *5*...)`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        if (parsed.locationName) {
          const coords = await resolveLocationCoordinates(parsed.locationName);
          if (coords) {
            sessionService.updateJobDraft(senderPhone, {
              locationName: coords.name,
              coordinates: coords
            });

            if (parsed.offeredDailyWage) {
              sessionService.updateJobDraft(senderPhone, { offeredDailyWage: parsed.offeredDailyWage });
              sessionService.updateSessionStep(senderPhone, 'AWAITING_TIMING');

              const reply =
                `✅ Category: *${parsed.category}* (${parsed.workersNeeded || 1} worker)\n` +
                `📍 Site: *${coords.name}*\n` +
                `💰 Dihadi: *₹${parsed.offeredDailyWage}/din*\n\n` +
                `📅 Kaam kis din aur samay par shuru hoga?\n` +
                `_Jaise: Kal subah 08:30 AM ya Aaj dopehar 2:00 PM_`;
              await whatsappService.sendTextMessage(senderPhone, reply);
              return { replyText: reply };
            }

            // Wage is missing
            sessionService.updateSessionStep(senderPhone, 'AWAITING_WAGE');
            const benchmark = wageBenchmarkService.getBenchmark(parsed.category);
            const reply =
              `✅ Category: *${parsed.category}* (${parsed.workersNeeded || 1} worker)\n` +
              `📍 Site: *${coords.name}* note ho gaya hai.\n\n` +
              `💰 Aap prati worker kitni dihadi (₹/day) offer kar rahe hain?\n` +
              `_Standard Market Rate: ₹${benchmark.standardMarketMin} - ₹${benchmark.standardMarketMax}_`;
            await whatsappService.sendTextMessage(senderPhone, reply);
            return { replyText: reply };
          }
        }

        // Location is missing
        sessionService.updateSessionStep(senderPhone, 'AWAITING_LOCATION');
        const reply =
          `✅ Category: *${parsed.category}* (${parsed.workersNeeded || 1} worker) note ho gaya hai.\n\n` +
          `📍 Work site ka area / address kya hai?\n` +
          `_Area & city name likhein (Jaise: Sector 62 Noida) ya WhatsApp se direct Location Pin (📍) share karein._`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }
    }

    // -------------------------------------------------------------
    // CONVERSATIONAL STATE MACHINE
    // -------------------------------------------------------------
    switch (session.step) {
      case 'IDLE':
      case 'CONFIRMED': {
        sessionService.updateSessionStep(senderPhone, 'AWAITING_WORK_DESCRIPTION');
        sessionService.updateJobDraft(senderPhone, {
          contractorPhone: session.phone,
          createdAt: new Date().toISOString()
        });

        const reply =
          `🙏 *Namaste! Helping Hand (हेल्पिंग हैंड) me aapka swagat hai.*\n\n` +
          `Yahan aapko construction & daily-wage work ke liye verified workers (Rajmistri, Mazdoor, Badhai, Plumber, Painter aadi) milte hain.\n\n` +
          `Aapko kis kaam ke liye worker chahiye?\n` +
          `_Jaise: "Kal subah Sector 62 Noida me 2 Rajmistri chahiye 900 dihadi"_ ya bas apna trade batayein.`;

        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_WORK_DESCRIPTION': {
        const detectedCategory = matchingService.detectCategoryFromText(cleanedText);

        sessionService.updateJobDraft(senderPhone, {
          workDescription: cleanedText
        });

        if (detectedCategory) {
          sessionService.updateJobDraft(senderPhone, { category: detectedCategory });
          sessionService.updateSessionStep(senderPhone, 'AWAITING_WORKER_COUNT');

          const reply =
            `✅ Category: *${detectedCategory}* note kar li gayi hai.\n\n` +
            `Aapko kitne worker chahiye? (e.g. *1*, *2*, *5*...)`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        } else {
          sessionService.updateSessionStep(senderPhone, 'AWAITING_CATEGORY');
          const reply =
            `Aapke kaam ke anusaar kripya worker category ka number reply karein:\n\n` +
            `1️⃣ *Rajmistri* (Mason / Plaster / Chunai)\n` +
            `2️⃣ *Mazdoor / Beldar* (Labour / Helper / Debris)\n` +
            `3️⃣ *Badhai* (Carpenter / Shuttering / Furniture)\n` +
            `4️⃣ *Nal Mistri* (Plumber / Piping)\n` +
            `5️⃣ *Bijli Mistri* (Electrician / Wiring)\n` +
            `6️⃣ *Rangai Mistri* (Painter / Putty)\n` +
            `7️⃣ *Farsh Mistri* (Tile / Marble / Granite)\n` +
            `8️⃣ *Sariya Mistri* (Welder / Rebar)\n\n` +
            `_Kripya 1 se 8 ke beech number likhein._`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }
      }

      case 'AWAITING_CATEGORY': {
        const category = matchingService.parseCategoryChoice(cleanedText);
        if (!category) {
          const reply =
            `⚠️ Kripya 1 se 8 ke beech valid number ya category name likhein.\n` +
            `1: Rajmistri, 2: Mazdoor, 3: Badhai, 4: Plumber, 5: Electrician, 6: Painter, 7: Tile, 8: Welder`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        sessionService.updateJobDraft(senderPhone, { category });
        sessionService.updateSessionStep(senderPhone, 'AWAITING_WORKER_COUNT');

        const reply =
          `👍 Category: *${category}* chuni gayi.\n\n` +
          `Aapko kitne worker chahiye? (e.g. *1*, *2*, *5*)`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_WORKER_COUNT': {
        const countMatch = cleanedText.match(/\d+/);
        if (!countMatch) {
          const reply = `Kripya workers ki sankhya (number) likhein, jaise: *1*, *2*, ya *4*`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        const count = parseInt(countMatch[0], 10);
        const validCount = Math.max(1, Math.min(count, 50));

        sessionService.updateJobDraft(senderPhone, { workersNeeded: validCount });
        sessionService.updateSessionStep(senderPhone, 'AWAITING_LOCATION');

        const reply =
          `📍 Work site ka area / address kya hai?\n\n` +
          `Aap area & city name likh sakte hain (Jaise: *Sector 18 Noida*, *Indirapuram Ghaziabad*, *Okhla Phase 3*)\n` +
          `Ya WhatsApp se direct Location Pin (📍) share kar sakte hain.`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_LOCATION': {
        let coords: { lat: number; lng: number } | null = null;
        let locName = cleanedText;

        if (incomingLocation) {
          coords = { lat: incomingLocation.lat, lng: incomingLocation.lng };
          locName = incomingLocation.name || `GPS (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`;
        } else {
          const resolved = await resolveLocationCoordinates(cleanedText);
          if (resolved) {
            coords = { lat: resolved.lat, lng: resolved.lng };
            locName = resolved.name;
          }
        }

        if (!coords) {
          const reply =
            `⚠️ Is location ke coordinates confirm nahi ho sake.\n\n` +
            `Kripya apna area & city name dobara likhein (Jaise: *Sector 62 Noida* ya *Indirapuram Ghaziabad*) ya WhatsApp se direct Location Pin (📍) share karein.`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        sessionService.updateJobDraft(senderPhone, {
          locationName: locName,
          coordinates: coords
        });
        sessionService.updateSessionStep(senderPhone, 'AWAITING_WAGE');

        const cat = (session.jobDraft.category as WorkerCategory) || 'MASON';
        const benchmark = wageBenchmarkService.getBenchmark(cat);

        const reply =
          `💰 Aap prati worker kitni dihadi (Daily Wage in ₹) offer kar rahe hain?\n\n` +
          `_Sector benchmark for ${benchmark.categoryHindi}: ₹${benchmark.standardMarketMin} - ₹${benchmark.standardMarketMax}_\n` +
          `Jaise reply karein: *${benchmark.standardMarketMin}* ya *${benchmark.standardMarketMax}*`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_WAGE': {
        const wageMatch = cleanedText.match(/\d+/);
        if (!wageMatch) {
          const reply = `Kripya valid numeric dihadi amount likhein, jaise: *800* ya *950*`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        const wage = parseInt(wageMatch[0], 10);
        const cat = (session.jobDraft.category as WorkerCategory) || 'MASON';
        const evaluation = wageBenchmarkService.evaluateWage(cat, wage);

        // REALISTIC FEATURE #2: WAGE LOWBALL WARNING & CORRECTION
        if (evaluation.isSeverelyUnderpaid) {
          sessionService.updateJobDraft(senderPhone, { offeredDailyWage: wage });
          sessionService.updateSessionStep(senderPhone, 'AWAITING_WAGE_CONFIRMATION');

          const reply =
            `${evaluation.advisoryMessage}\n\n` +
            `👉 Reply *1* to upgrade wage to *₹${evaluation.recommendedWage}*\n` +
            `👉 Reply *2* to continue with your offer *₹${wage}*`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }

        sessionService.updateJobDraft(senderPhone, { offeredDailyWage: wage });
        sessionService.updateSessionStep(senderPhone, 'AWAITING_TIMING');

        const reply =
          `📅 Kaam kis din aur samay par shuru hoga?\n\n` +
          `_Jaise: Kal subah 08:30 AM, Aaj dopehar 2:00 PM, ya 5 November..._`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_WAGE_CONFIRMATION': {
        const isUpgrade = ['1', 'upgrade', 'yes', 'haan', 'ha'].includes(lowerText);
        const cat = (session.jobDraft.category as WorkerCategory) || 'MASON';
        const benchmark = wageBenchmarkService.getBenchmark(cat);

        if (isUpgrade) {
          sessionService.updateJobDraft(senderPhone, { offeredDailyWage: benchmark.standardMarketMin });
        }
        // If 2, keeps the contractor's offered wage

        sessionService.updateSessionStep(senderPhone, 'AWAITING_TIMING');
        const currentWage = session.jobDraft.offeredDailyWage;

        const reply =
          `👍 Dihadi *₹${currentWage}/din* confirm kar li gayi hai.\n\n` +
          `📅 Kaam kis din aur samay par shuru hoga?\n` +
          `_Jaise: Kal subah 08:30 AM, Aaj dopehar 2:00 PM_`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      case 'AWAITING_TIMING': {
        const shiftTiming = cleanedText;
        sessionService.updateJobDraft(senderPhone, { shiftDate: shiftTiming });
        return await this.renderBookingSummaryAndAwaitingConfirm(senderPhone);
      }

      case 'AWAITING_CONFIRMATION': {
        const isConfirm = ['1', 'yes', 'haan', 'ha', 'confirm', 'ok', 'sahi hai'].includes(lowerText);
        const isDecline = ['0', 'no', 'cancel', 'nahi'].includes(lowerText);

        const currentJobId = session.jobDraft.id;
        const job = currentJobId ? sessionService.getJob(currentJobId) : undefined;

        if (isConfirm && job) {
          sessionService.updateSessionStep(senderPhone, 'DISPATCHING');
          job.status = 'CALLING';
          sessionService.saveJob(job);

          const topMatch = job.matchedCandidates[0];
          const needed = job.workersNeeded || 1;

          const progressReply =
            `🚀 *Booking Confirmed! (ID: #${job.id})*\n\n` +
            `Humara automated telephony system top-rated worker *${topMatch.worker.name}* (${topMatch.worker.rating}★, ${topMatch.distanceKm} km door) ko automated call mila raha hai... 📞\n\n` +
            (needed > 1 ? `👥 Kul ${needed} workers sequentially call kiye jayenge.\n` : '') +
            `Worker ke accept karte hi aapko unka direct mobile number yahan bhej diya jayega. Kripya 30 seconds wait karein.`;

          await whatsappService.sendTextMessage(senderPhone, progressReply);

          try {
            await ivrCallService.dispatchWorkerCall(job, 0);
          } catch (err: any) {
            console.error('[Workflow] Telephony dispatch error:', err.message);
          }

          return { replyText: progressReply, job };
        } else if (isDecline) {
          sessionService.resetSession(senderPhone);
          const reply = `❌ Booking cancel kar di gayi hai. Nayi booking ke liye *Hi* likhein.`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        } else {
          const reply =
            `Kripya confirm karne ke liye *1* (YES) ya cancel karne ke liye *0* (CANCEL) reply karein.`;
          await whatsappService.sendTextMessage(senderPhone, reply);
          return { replyText: reply };
        }
      }

      case 'DISPATCHING': {
        const reply =
          `⏳ Worker calls in progress hain. Responses milte hi aapko instant update milega.\n` +
          `Nayi inquiry ke liye *reset* likhein.`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }

      default: {
        sessionService.resetSession(senderPhone);
        const reply = `Namaste! Nayi inquiry ke liye kripya *Hi* likhein.`;
        await whatsappService.sendTextMessage(senderPhone, reply);
        return { replyText: reply };
      }
    }
  }

  /**
   * Helper that ranks candidates and delivers the final Booking Summary Card
   */
  private async renderBookingSummaryAndAwaitingConfirm(
    senderPhone: string
  ): Promise<{ replyText: string; job?: JobRequest }> {
    const session = sessionService.getOrCreateSession(senderPhone);
    const draft = session.jobDraft;

    let candidateMatches;
    try {
      candidateMatches = matchingService.rankWorkersForJob(draft);
    } catch (err: any) {
      console.error('[Workflow] Error during matching:', err);
      const reply = `⚠️ Error finding workers: ${err?.message || 'Invalid parameters'}. Kripya *reset* likhein.`;
      await whatsappService.sendTextMessage(senderPhone, reply);
      return { replyText: reply };
    }

    if (candidateMatches.length === 0) {
      const reply =
        `⚠️ Maaf kijiye, is category ke liye is samay koi worker uplabdh nahi hai. Kripya doosri category ke liye *reset* likhein.`;
      await whatsappService.sendTextMessage(senderPhone, reply);
      return { replyText: reply };
    }

    const topCandidate = candidateMatches[0];
    const bookingId = `HH-${Date.now().toString().slice(-4)}`;
    const workersNeeded = draft.workersNeeded || 1;
    const totalDailyPayout = (draft.offeredDailyWage || 0) * workersNeeded;

    const fullJob: JobRequest = {
      id: bookingId,
      contractorPhone: senderPhone,
      workDescription: draft.workDescription || 'Construction Work',
      category: draft.category as WorkerCategory,
      workersNeeded: workersNeeded,
      locationName: draft.locationName || 'Specified Site',
      coordinates: draft.coordinates!,
      offeredDailyWage: draft.offeredDailyWage || 0,
      shiftDate: draft.shiftDate || 'Tomorrow 8:30 AM',
      status: 'COLLECTING',
      matchedCandidates: candidateMatches,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    sessionService.saveJob(fullJob);
    sessionService.updateJobDraft(senderPhone, { id: bookingId });
    sessionService.updateSessionStep(senderPhone, 'AWAITING_CONFIRMATION');

    const multiWorkerNote =
      workersNeeded > 1
        ? `\n👥 *Full Crew Fulfillment:* Top ${workersNeeded} workers will be called sequentially.`
        : '';

    const reply =
      `📋 *Booking Summary - Helping Hand*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🆔 *Booking ID:* #${bookingId}\n` +
      `👷 *Category:* ${fullJob.category}\n` +
      `👥 *Workers Needed:* ${fullJob.workersNeeded}\n` +
      `📍 *Work Site:* ${fullJob.locationName}\n` +
      `💰 *Daily Wage:* ₹${fullJob.offeredDailyWage}/worker/day (Kul ₹${totalDailyPayout}/din)\n` +
      `📅 *Reporting Time:* ${fullJob.shiftDate}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `🎯 *Top Priority Match:* ${topCandidate.worker.name} (${topCandidate.worker.rating}★, ~${topCandidate.distanceKm} km door)` +
      multiWorkerNote +
      `\n\nKya aap booking confirm karna chahte hain?\n` +
      `👉 Reply *1* ya *YES* to dispatch automated call\n` +
      `👉 Reply *0* ya *CANCEL* to cancel`;

    await whatsappService.sendTextMessage(senderPhone, reply);
    return { replyText: reply, job: fullJob };
  }
}

export const workflowEngine = new WorkflowEngine();
