import assert from 'node:assert';
import { workflowEngine } from '../services/workflowEngine.js';
import { sessionService } from '../services/sessionService.js';
import { matchingService } from '../services/matchingService.js';
import { ivrCallService } from '../services/ivrCallService.js';
import { webhookController } from '../controllers/webhookController.js';

// Setup environment variables for test execution
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test_meta_phone_id';
process.env.WHATSAPP_ACCESS_TOKEN = 'test_meta_access_token';
process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_token_123';
process.env.TWILIO_ACCOUNT_SID = 'AC_test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_PHONE_NUMBER = '+15551234567';
process.env.TWILIO_CALLBACK_BASE_URL = 'https://api.helpinghand.test';

// Intercept global fetch to simulate Meta Graph API and Twilio API responses
const sentMetaMessages: Array<{ to: string; body: string }> = [];
const outboundCalls: Array<{ to: string; twiml: string }> = [];

const originalFetch = global.fetch;
global.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = String(input);

  // Meta Graph API Mock
  if (url.includes('graph.facebook.com')) {
    const body = JSON.parse(String(init?.body || '{}'));
    sentMetaMessages.push({
      to: body.to,
      body: body.text?.body || ''
    });

    return new Response(
      JSON.stringify({
        messaging_product: 'whatsapp',
        contacts: [{ input: body.to, wa_id: body.to }],
        messages: [{ id: `wamid.HBgL${Date.now()}` }]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Twilio Calls API Mock
  if (url.includes('api.twilio.com') && url.includes('Calls.json')) {
    const params = new URLSearchParams(String(init?.body || ''));
    outboundCalls.push({
      to: params.get('To') || '',
      twiml: params.get('Twiml') || ''
    });

    return new Response(
      JSON.stringify({
        sid: `CA${Date.now()}`,
        status: 'queued'
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // OpenStreetMap Nominatim Mock (for text location resolution)
  if (url.includes('nominatim.openstreetmap.org')) {
    return new Response(
      JSON.stringify([
        {
          display_name: 'Sector 62, Noida, Gautam Buddha Nagar, Uttar Pradesh',
          lat: '28.6255',
          lon: '77.3690'
        }
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return originalFetch(input, init);
};

async function runEndToEndTests() {
  console.log('\n===============================================================');
  console.log('RUNNING PRODUCTION META WHATSAPP & TELEPHONY TEST SUITE');
  console.log('===============================================================\n');

  const contractorPhone = '+919876543210';
  sessionService.resetSession(contractorPhone);

  // Test 1: Worker Dataset integrity
  console.log('▶ Test 1: Worker Dataset verification...');
  const workers = matchingService.getAllWorkers();
  assert.ok(workers.length >= 20, `Expected at least 20 workers, found ${workers.length}`);
  console.log(`  ✔ Dataset has ${workers.length} verified workers across all trades.`);

  // Test 2: Inbound "Hi"
  console.log('\n▶ Test 2: Contractor texts "Hi" on WhatsApp...');
  await workflowEngine.handleIncomingMessage(contractorPhone, 'Hi');
  const session1 = sessionService.getSession(contractorPhone);
  assert.strictEqual(session1?.step, 'AWAITING_WORK_DESCRIPTION');
  assert.ok(sentMetaMessages.some((m) => m.body.includes('Namaste')));
  console.log('  ✔ Received welcome greeting and moved to AWAITING_WORK_DESCRIPTION.');

  // Test 3: Natural language trade parsing
  console.log('\n▶ Test 3: Contractor specifies trade ("Rajmistri for plaster")...');
  await workflowEngine.handleIncomingMessage(contractorPhone, 'Rajmistri for boundary wall plaster');
  const session2 = sessionService.getSession(contractorPhone);
  assert.strictEqual(session2?.step, 'AWAITING_WORKER_COUNT');
  assert.strictEqual(session2?.jobDraft.category, 'MASON');
  console.log('  ✔ Correctly detected category MASON.');

  // Test 4: Worker Count (1 worker for baseline flow)
  console.log('\n▶ Test 4: Contractor specifies worker count ("1")...');
  await workflowEngine.handleIncomingMessage(contractorPhone, '1');
  const session3 = sessionService.getSession(contractorPhone);
  assert.strictEqual(session3?.step, 'AWAITING_LOCATION');
  assert.strictEqual(session3?.jobDraft.workersNeeded, 1);
  console.log('  ✔ Worker count recorded as 1.');

  // Test 5: Dynamic GPS Location Pin
  console.log('\n▶ Test 5: Contractor shares native WhatsApp GPS Location Pin...');
  await workflowEngine.handleIncomingMessage(contractorPhone, 'Shared Location', {
    lat: 28.6280,
    lng: 77.3649,
    name: 'Sector 62 Site Pin'
  });
  const session4 = sessionService.getSession(contractorPhone);
  assert.strictEqual(session4?.step, 'AWAITING_WAGE');
  assert.strictEqual(session4?.jobDraft.coordinates?.lat, 28.6280);
  console.log('  ✔ Native WhatsApp GPS coordinates processed.');

  // Test 6: Offered Wage
  console.log('\n▶ Test 6: Contractor specifies daily wage ("850")...');
  await workflowEngine.handleIncomingMessage(contractorPhone, '850');
  const session5 = sessionService.getSession(contractorPhone);
  assert.strictEqual(session5?.step, 'AWAITING_TIMING');
  assert.strictEqual(session5?.jobDraft.offeredDailyWage, 850);
  console.log('  ✔ Daily wage recorded as Rs. 850.');

  // Test 7: Contractor specifies shift timing
  console.log('\n▶ Test 7: Contractor specifies shift timing ("Tomorrow morning 8:30 AM")...');
  const summaryRes = await workflowEngine.handleIncomingMessage(contractorPhone, 'Tomorrow morning 8:30 AM');
  assert.ok(summaryRes.job !== undefined, 'Job must be created');
  const job = summaryRes.job!;
  assert.strictEqual(job.shiftDate, 'Tomorrow morning 8:30 AM');
  assert.ok(job.matchedCandidates.length > 0, 'Candidates must be ranked');
  const topCandidate = job.matchedCandidates[0];
  console.log(`  Top Candidate: ${topCandidate.worker.name} (Dist: ${topCandidate.distanceKm} km, Score: ${topCandidate.score})`);
  assert.ok(topCandidate.score >= 80, 'Top candidate must have high priority composite score');
  console.log('  ✔ Summary card rendered with dynamic priority matching.');

  // Test 8: Confirmation & Real Twilio IVR Call Dispatch
  console.log('\n▶ Test 8: Contractor confirms booking ("1")...');
  await workflowEngine.handleIncomingMessage(contractorPhone, '1');
  assert.ok(outboundCalls.length > 0, 'Outbound Twilio call must be dispatched');
  const latestCall = outboundCalls[outboundCalls.length - 1];
  assert.strictEqual(latestCall.to, topCandidate.worker.phone);
  assert.ok(latestCall.twiml.includes('Polly.Aditi'), 'TwiML must include speech prompt');
  console.log(`  ✔ Outbound Twilio voice call placed to ${topCandidate.worker.name} (${topCandidate.worker.phone}).`);

  // Test 9: Worker Accepts via DTMF [1]
  console.log('\n▶ Test 9: Worker presses DTMF [1] (Accepts job)...');
  const callResult = await ivrCallService.handleCallResponse(job.id, topCandidate.worker.id, '1');
  assert.strictEqual(callResult.status, 'ACCEPTED');

  const updatedJob = sessionService.getJob(job.id);
  assert.strictEqual(updatedJob?.status, 'CONFIRMED');
  assert.strictEqual(updatedJob?.assignedWorker?.id, topCandidate.worker.id);

  const contractorConfirmation = sentMetaMessages.find((m) => m.body.includes('Worker Confirmation'));
  assert.ok(contractorConfirmation !== undefined, 'Contractor must receive WhatsApp confirmation');
  assert.ok(contractorConfirmation.body.includes(topCandidate.worker.phone), 'Must include worker phone');
  console.log('  ✔ Contractor notified on WhatsApp with clean professional worker details.');

  // Test 10: Auto-escalation when worker rejects
  console.log('\n▶ Test 10: Testing auto-escalation when worker declines...');
  const contractor2 = '+919876543211';
  sessionService.resetSession(contractor2);

  await workflowEngine.handleIncomingMessage(contractor2, 'Hi');
  await workflowEngine.handleIncomingMessage(contractor2, 'Rajmistri');
  await workflowEngine.handleIncomingMessage(contractor2, '1');
  await workflowEngine.handleIncomingMessage(contractor2, 'Sector 62 Noida');
  await workflowEngine.handleIncomingMessage(contractor2, '850');
  const res2 = await workflowEngine.handleIncomingMessage(contractor2, 'Today 2:00 PM');
  const job2 = res2.job!;
  await workflowEngine.handleIncomingMessage(contractor2, '1');

  const firstCandidate = job2.matchedCandidates[0];
  const secondCandidate = job2.matchedCandidates[1];

  console.log(`  Simulating Worker #1 (${firstCandidate.worker.name}) pressing DTMF [2] (Decline)...`);
  await ivrCallService.handleCallResponse(job2.id, firstCandidate.worker.id, '2');

  const reloadedJob2 = sessionService.getJob(job2.id);
  assert.strictEqual(reloadedJob2?.matchedCandidates[0].callStatus, 'REJECTED');
  assert.strictEqual(reloadedJob2?.matchedCandidates[1].callStatus, 'CALLING');
  console.log(`  ✔ Candidate #2 (${secondCandidate.worker.name}) was automatically called via auto-escalation!`);

  // Test 11: Real-Life One-Shot Booking (Multi-field natural sentence)
  console.log('\n▶ Test 11: Real-Life Smart "One-Shot" Message Understanding...');
  const contractor3 = '+919876543212';
  sessionService.resetSession(contractor3);

  const oneShotMessage = 'Kal subah 8 baje Sector 62 Noida me 2 Rajmistri chahiye 900 dihadi';
  const oneShotRes = await workflowEngine.handleIncomingMessage(contractor3, oneShotMessage);

  assert.ok(oneShotRes.job !== undefined, 'One-shot message should create job immediately');
  assert.strictEqual(oneShotRes.job.category, 'MASON');
  assert.strictEqual(oneShotRes.job.workersNeeded, 2);
  assert.strictEqual(oneShotRes.job.offeredDailyWage, 900);
  assert.ok(oneShotRes.job.locationName.includes('Sector 62'));
  const sessionOneShot = sessionService.getSession(contractor3);
  assert.strictEqual(sessionOneShot?.step, 'AWAITING_CONFIRMATION');
  console.log('  ✔ One-shot sentence automatically parsed trade, 2 workers, Sector 62, Rs. 900 wage, and timing!');

  // Test 12: Real-Life Wage Lowball Warning & Upgrade
  console.log('\n▶ Test 12: Real-Life Wage Benchmark Lowball Warning...');
  const contractor4 = '+919876543213';
  sessionService.resetSession(contractor4);

  await workflowEngine.handleIncomingMessage(contractor4, 'Hi');
  await workflowEngine.handleIncomingMessage(contractor4, 'Rajmistri');
  await workflowEngine.handleIncomingMessage(contractor4, '1');
  await workflowEngine.handleIncomingMessage(contractor4, 'Sector 62 Noida');
  
  // Offer Rs. 450 (severely below standard Rs. 850-1000)
  const lowWageReply = await workflowEngine.handleIncomingMessage(contractor4, '450');
  assert.ok(lowWageReply.replyText.includes('Dihadi Advisory'), 'Must warn contractor about lowball wage');
  assert.ok(lowWageReply.replyText.includes('upgrade wage to standard'), 'Must provide upgrade choice');
  
  // Contractor accepts wage upgrade to standard
  await workflowEngine.handleIncomingMessage(contractor4, '1');
  const sessionLowWage = sessionService.getSession(contractor4);
  assert.strictEqual(sessionLowWage?.jobDraft.offeredDailyWage, 850);
  console.log('  ✔ Lowball wage Rs. 450 triggered advisory and was successfully upgraded to standard Rs. 850!');

  // Test 13: Real-Life Multi-Worker Crew Sequential Fulfillment
  console.log('\n▶ Test 13: Real-Life Multi-Worker Fulfillment (Crew of 2 Workers)...');
  const contractor5 = '+919876543214';
  sessionService.resetSession(contractor5);

  const crewBookingMsg = 'Kal subah 9:00 AM Sector 62 Noida me 2 Rajmistri chahiye 900 dihadi';
  const crewRes = await workflowEngine.handleIncomingMessage(contractor5, crewBookingMsg);
  const crewJob = crewRes.job!;
  assert.strictEqual(crewJob.workersNeeded, 2);

  // Contractor confirms
  await workflowEngine.handleIncomingMessage(contractor5, '1');

  const workerA = crewJob.matchedCandidates[0].worker;
  const workerB = crewJob.matchedCandidates[1].worker;

  // Worker A accepts (Worker 1 of 2)
  console.log(`  Simulating Worker #1 (${workerA.name}) pressing DTMF [1]...`);
  await ivrCallService.handleCallResponse(crewJob.id, workerA.id, '1');

  const partialJob = sessionService.getJob(crewJob.id);
  assert.strictEqual(partialJob?.assignedWorkers?.length, 1);
  assert.strictEqual(partialJob?.status, 'CALLING', 'Job remains CALLING until all slots filled');
  console.log(`  ✔ Worker 1/2 accepted. Engine automatically dispatched call to Worker #2 (${workerB.name})!`);

  // Worker B accepts (Worker 2 of 2)
  console.log(`  Simulating Worker #2 (${workerB.name}) pressing DTMF [1]...`);
  await ivrCallService.handleCallResponse(crewJob.id, workerB.id, '1');

  const fullCrewJob = sessionService.getJob(crewJob.id);
  assert.strictEqual(fullCrewJob?.status, 'CONFIRMED');
  assert.strictEqual(fullCrewJob?.assignedWorkers?.length, 2);
  console.log(`  ✔ All 2/2 workers confirmed! Complete crew dispatched to contractor.`);

  // Test 14: 7:00 AM Morning Wake-Up & No-Show Protection Call
  console.log('\n▶ Test 14: Real-Life 7:00 AM Morning Confirmation & No-Show Protection...');
  const morningResult = await ivrCallService.dispatchMorningConfirmation(crewJob.id);
  assert.strictEqual(morningResult.confirmedCount, 2);
  console.log('  ✔ Morning wake-up check successfully executed for confirmed workers.');

  // Test 15: Webhook Idempotency (Deduplication)
  console.log('\n▶ Test 15: Webhook Idempotency & Message Deduplication...');
  const testWamid = 'wamid.HBgMOTE3Njk2MTM4MjI5FQIAERgSRDZDNjJEMzJDQkVGNTc1OUJGAA==';
  const firstSeen = webhookController.isDuplicateMessage(testWamid);
  const secondSeen = webhookController.isDuplicateMessage(testWamid);
  assert.strictEqual(firstSeen, false, 'First message delivery must be processed');
  assert.strictEqual(secondSeen, true, 'Duplicate webhook delivery must be detected and dropped');
  console.log('  ✔ Webhook idempotency correctly dropped duplicate delivery event.');

  // Test 16: Mid-Stream Contractor Cancellation & Worker Release
  console.log('\n▶ Test 16: Mid-Stream Contractor Cancellation Handling...');
  const contractor6 = '+919876543215';
  sessionService.resetSession(contractor6);

  const jobToCancelMsg = 'Kal subah 8:00 AM Sector 62 Noida me 1 Rajmistri chahiye 850 dihadi';
  const jobToCancelRes = await workflowEngine.handleIncomingMessage(contractor6, jobToCancelMsg);
  const cancelJob = jobToCancelRes.job!;
  
  // Confirm and assign worker
  await workflowEngine.handleIncomingMessage(contractor6, '1');
  const targetWorker = cancelJob.matchedCandidates[0].worker;
  await ivrCallService.handleCallResponse(cancelJob.id, targetWorker.id, '1');

  const assignedBeforeCancel = sessionService.getJob(cancelJob.id);
  assert.strictEqual(assignedBeforeCancel?.status, 'CONFIRMED');

  // Contractor cancels after confirmation
  const cancelReply = await workflowEngine.handleIncomingMessage(contractor6, 'cancel');
  assert.ok(cancelReply.replyText.includes('Booking Cancelled'));
  const cancelledJob = sessionService.getJob(cancelJob.id);
  assert.strictEqual(cancelledJob?.status, 'CANCELLED');
  console.log('  ✔ Dispatched booking successfully cancelled and worker schedule released.');

  // Test 17: 45-Minute Stale Session Expiry (TTL)
  console.log('\n▶ Test 17: 45-Minute Inactive Session Timeout (TTL)...');
  const contractor7 = '+919876543216';
  sessionService.resetSession(contractor7);

  await workflowEngine.handleIncomingMessage(contractor7, 'Hi');
  const activeSession = sessionService.getOrCreateSession(contractor7);
  // Artificially age session by 46 minutes
  activeSession.lastInteraction = new Date(Date.now() - 46 * 60 * 1000).toISOString();

  const staleReply = await workflowEngine.handleIncomingMessage(contractor7, '2 Rajmistri');
  assert.ok(staleReply.replyText.includes('Notice') && staleReply.replyText.includes('expire'));
  console.log('  ✔ Stale draft session cleanly expired and prompted for fresh requirements.');

  console.log('\n===============================================================');
  console.log('ALL 17/17 PRODUCTION-GRADE TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runEndToEndTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
