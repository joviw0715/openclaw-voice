/**
 * Twilio HTTP Webhook Handler
 * Handles incoming call events and returns TwiML with Media Stream URL
 */

import { Processor } from 'whisper-node';
import axios from 'axios';

export async function webhookHandler(req, res) {
  try {
    const {
      CallSid,
      To,
      From,
      CallerName,
      CallerPosition,
      CallStatus
    } = req.body;

    console.log(`📞 Incoming call: ${CallSid}`);
    console.log(`  From: ${From}`);
    console.log(`  To: ${To}`);
    console.log(`  CallerName: ${CallerName || 'Unknown'}`);
    console.log(`  Status: ${CallStatus}`);
    console.log(`  CallerPosition: ${CallerPosition}`);

    // Check if this is a CallStatus callback or initial call
    const isStatusCallback = req.body.CallStatus !== undefined;
    if (isStatusCallback) {
      console.log(`  Custom SMS StatusCallback: ${req.body.CallStatus}`);
      return res.status(200).end();
    }

    // TwiML Response with Media Stream
    // Replace with your actual domain
    const domain = process.env.DOMAIN || 'openclaw-yotta.zeabur.app';
    const streamUrl = `wss://${domain}/voice/stream?CallSid=${CallSid}&From=${From}`;

    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="${streamUrl}" />
  </Start>
  <Redirect method="GET" />
</Response>`;

    // Add status callback to return events to webhook
    const statusCallbackUrl = `https://${domain}/voice/webhook`;
    const statusCallbackMethod = 'POST';

    console.log(`✅ Sending TwiML with Media Stream URL to Twilio`);
    res.set('Content-Type', 'text/xml');
    res.send(twiML);

    // Send status update to webhook (in a real implementation, you'd emit this event)
    console.log(`📊 Status callback: ${statusCallbackUrl}`);

  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    res.status(500).xml('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}