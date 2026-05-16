/**
 * Outbound Call Handler
 * Initiates a call from openclaw (Twilio number) → a target phone number.
 *
 * POST /voice/call
 * Body: { to: "+886912345678", message: "Optional greeting spoken when answered" }
 */

import axios from 'axios';

export async function outboundCallHandler(req, res) {
  try {
    const { to, message } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Missing required field: to (phone number)' });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;
    const from       = process.env.TWILIO_PHONE_NUMBER;
    const domain     = process.env.DOMAIN || 'openclaw-voice.zeabur.app';

    if (!accountSid || !authToken || !from) {
      return res.status(500).json({
        error: 'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file.'
      });
    }

    // When Twilio answers on the other end, it will POST to this URL for TwiML instructions.
    // We pass the optional greeting message and direction as query params so the webhook
    // can use them when building the TwiML / stream URL.
    const webhookUrl = new URL(`https://${domain}/voice/webhook`);
    webhookUrl.searchParams.set('direction', 'outbound');
    if (message) webhookUrl.searchParams.set('greeting', message);

    console.log(`📲 Initiating outbound call to ${to}`);

    const TWILIO_SID_RE = /^AC[0-9a-f]{32}$/i;
    if (!TWILIO_SID_RE.test(accountSid)) {
      return res.status(500).json({ error: 'TWILIO_ACCOUNT_SID has an invalid format.' });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const params = new URLSearchParams({
      To:   to,
      From: from,
      Url:  webhookUrl.toString(),
      StatusCallback:       `https://${domain}/voice/webhook`,
      StatusCallbackMethod: 'POST',
    });

    const response = await axios.post(twilioUrl, params.toString(), {
      auth: { username: accountSid, password: authToken },
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const call = response.data;
    console.log(`✅ Outbound call created: ${call.sid} (status: ${call.status})`);

    return res.status(201).json({
      callSid: call.sid,
      status:  call.status,
      to:      call.to,
      from:    call.from,
    });

  } catch (err) {
    const twilioError = err.response?.data;
    console.error('❌ Outbound call error:', twilioError || err.message);
    return res.status(500).json({
      error:   'Failed to initiate outbound call',
      details: twilioError || err.message
    });
  }
}
