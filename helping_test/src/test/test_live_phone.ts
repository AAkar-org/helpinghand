import 'dotenv/config';
import { workflowEngine } from '../services/workflowEngine.js';

const testPhone = process.argv[2] || '917696138229';
const messageText = process.argv[3] || 'Hi';

console.log(`\n======================================================`);
console.log(`🧪 TESTING LIVE WHATSAPP FLOW (100% FREE / ZERO COST)`);
console.log(`======================================================`);
console.log(`📱 Recipient Phone: ${testPhone}`);
console.log(`💬 Inbound Simulated Message: "${messageText}"`);
console.log(`💰 Twilio Mode: SIMULATED (Zero Call Charges)`);
console.log(`💰 Meta Mode: SANDBOX (Free 1,000 Conversations/Mo)`);
console.log(`======================================================\n`);

async function run() {
  try {
    const result = await workflowEngine.handleIncomingMessage(testPhone, messageText);
    console.log(`\n✅ Outbound message successfully sent to your WhatsApp!\n`);
    console.log(`Message Content Sent:\n---\n${result.replyText}\n---`);
  } catch (err: any) {
    console.error(`❌ Error sending message:`, err.message);
  }
}

run();

