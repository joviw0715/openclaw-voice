/**
 * Twilio HTTP Webhook Handler
 * Handles incoming and outbound call events and returns TwiML with Media Stream URL
 */

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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

    // Twilio status callbacks include CallbackSource=call-progress-events.
    // Return early without TwiML for these.
    if (req.body.CallbackSource === 'call-progress-events') {
      console.log(`📊 Status callback for ${CallSid}: ${CallStatus}`);
      return res.status(200).end();
    }

    console.log(`📞 Call webhook: ${CallSid}`);
    console.log(`  From: ${From}`);
    console.log(`  To: ${To}`);
    console.log(`  CallerName: ${CallerName || 'Unknown'}`);
    console.log(`  Status: ${CallStatus}`);
    console.log(`  CallerPosition: ${CallerPosition}`);

    const domain = process.env.DOMAIN || 'openclaw-voice.zeabur.app';
    const direction = ['inbound', 'outbound'].includes(req.query.direction)
      ? req.query.direction
      : 'inbound';
    const streamUrl = `wss://${domain}/voice/stream?CallSid=${encodeURIComponent(CallSid || '')}&From=${encodeURIComponent(From || '')}&Direction=${direction}`;

    // Optional spoken greeting for outbound calls
    const greeting = req.query.greeting ? String(req.query.greeting) : null;
    const sayBlock = greeting
      ? `\n  <Say voice="Polly.Joanna">${xmlEscape(greeting)}</Say>`
      : '';

    const twiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>${sayBlock}
  <Start>
    <Stream url="${xmlEscape(streamUrl)}" />
  </Start>
  <Redirect method="GET" />
</Response>`;

    console.log(`✅ Sending TwiML with Media Stream URL to Twilio (${direction})`);
    res.set('Content-Type', 'text/xml');
    res.send(twiML);

  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
}
