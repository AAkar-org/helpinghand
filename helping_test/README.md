# 🤝 Helping Hand — Meta WhatsApp Automation & Telephony Engine

Production-ready Meta WhatsApp Cloud API conversational engine and automated worker telephony dispatch system for real market testing with builders and contractors.

---

## ⚡ Architecture & Flow

```
[Contractor on WhatsApp]
       │
       ▼ (Sends "Hi", "Rajmistri", Location Pin 📍, Wage, Shift Timing)
[Meta WhatsApp Cloud API Webhook] -> (POST /webhook)
       │
       ▼
[Conversational State Engine] (src/services/workflowEngine.ts)
       │
       ▼
[Haversine Priority Matching] (src/services/matchingService.ts)
       │
       ▼
[Twilio Outbound IVR Call to Candidate #1] (src/services/ivrCallService.ts)
       │
       ├──> Worker presses [1] (Accept)  ──> Instant WhatsApp confirmation to Contractor with Worker contact
       └──> Worker presses [2] (Decline) ──> Auto-escalates to Candidate #2 in priority queue
```

---

## 🔑 Setup in 3 Minutes

### 1. Fill Meta Credentials in `.env`
Open `helping_test/.env` and paste:
```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta
WHATSAPP_ACCESS_TOKEN=your_system_user_token_from_meta
WHATSAPP_VERIFY_TOKEN=any_secret_passphrase_you_choose

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
TWILIO_CALLBACK_BASE_URL=https://your-public-domain.ngrok-free.app
```

### 2. Start the Engine
```bash
cd helping_test
npm start
```

### 3. Expose to Meta Webhook (via ngrok)
```bash
ngrok http 4000
```
In your **Meta App Dashboard** -> **WhatsApp** -> **Configuration**:
- **Callback URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/webhook`
- **Verify Token**: (The value you set for `WHATSAPP_VERIFY_TOKEN`)
- **Webhook Fields**: Click **Manage** and subscribe to `messages`.

Now, any contractor or builder sending a message to your WhatsApp number will immediately interact with the real automated workflow!

---

## 🧪 Run Automated Tests
```bash
cd helping_test
npm test
```
Runs 10/10 automated tests verifying:
- Worker dataset across 8 trades
- Inbound Meta WhatsApp webhook handling
- Natural language trade classification
- Dynamic GPS location handling (WhatsApp Location Pin 📍)
- Haversine distance prioritization
- Outbound Twilio voice call generation with TwiML
- Worker DTMF [1] acceptance & WhatsApp confirmation
- Worker DTMF [2] decline & automatic escalation to next candidate
