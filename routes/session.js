/**
 * Call Session Manager
 * In-memory session tracking for active calls
 */

export const activeCalls = new Map(); // callSid -> { ws, callSid, from, to, startedAt }

/**
 * Register an active call
 */
export function registerCall(callSid, ws, from, to) {
  activeCalls.set(callSid, {
    callSid,
    ws,
    from,
    to,
    startedAt: Date.now(),
    transcript: []
  });
  console.log(`✅ Registered call: ${callSid}`);
}

/**
 * Update call transport with new WebSocket
 */
export function updateCallTransport(callSid, ws) {
  if (activeCalls.has(callSid)) {
    const call = activeCalls.get(callSid);
    call.ws = ws;
    console.log(`🔄 Updated WebSocket for call: ${callSid}`);
  }
}

/**
 * Get call session
 */
export function getCallSession(callSid) {
  return activeCalls.get(callSid);
}

/**
 * Get all active calls
 */
export function getAllCalls() {
  return Array.from(activeCalls.values()).map(call => ({
    callSid: call.callSid,
    from: call.from,
    to: call.to,
    duration: Date.now() - call.startedAt,
    transcript: call.transcript
  }));
}

/**
 * End a call and cleanup
 */
export function endCall(callSid) {
  if (activeCalls.has(callSid)) {
    const call = activeCalls.get(callSid);
    const duration = Date.now() - call.startedAt;
    console.log(`⏹️ Ending call: ${callSid} (${duration}ms)`);
    activeCalls.delete(callSid);
    return call;
  }
}

/**
 * Add transcript to call session
 */
export function addTranscript(callSid, text, role) {
  if (activeCalls.has(callSid)) {
    const call = activeCalls.get(callSid);
    call.transcript.push({
      text,
      role,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get transcript for a call
 */
export function getTranscript(callSid) {
  const call = getCallSession(callSid);
  return call?.transcript || [];
}