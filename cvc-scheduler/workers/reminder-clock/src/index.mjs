import { REMINDER_ENDPOINT, TIMESTAMP_HEADER, SIGNATURE_HEADER, signSchedulerRequest } from './protocol.mjs';

// The clock owns no eligibility, identity, retry, or email logic.
export async function runScheduled(event, env, { request = fetch, now = Date.now, log = entry => console.info(JSON.stringify(entry)) } = {}) {
  const started = now();
  const metadata = { event: 'reminder_clock', scheduledAt: event.scheduledTime, statusClass: null, durationMs: 0, outcome: 'configuration_failure' };
  const deadline = AbortSignal.timeout(10_000);
  try {
    const timestamp = String(Math.floor(started / 1000));
    const signature = await signSchedulerRequest(env.REMINDER_SCHEDULER_HMAC_SECRET, timestamp);
    const response = await request(REMINDER_ENDPOINT, {
      method: 'POST', headers: { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature },
      redirect: 'manual', signal: deadline, cache: 'no-store',
    });
    metadata.statusClass = `${Math.floor(response.status / 100)}xx`;
    metadata.outcome = 'http_failure';
    if (response.status >= 300 && response.status < 400) {
      metadata.outcome = 'redirect_rejected';
      await response.body?.cancel();
    } else if (response.status === 200 && response.headers.get('content-type')?.includes('application/json')) {
      // Bounded body: no private content is retained or logged, even on error.
      const reader = response.body?.getReader();
      let text = '', bytes = 0;
      if (!reader) throw new Error('Missing response');
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 4096) throw new Error('Oversized response');
          text += new TextDecoder().decode(value, { stream: true });
        }
        const result = JSON.parse(text);
        metadata.outcome = result.phase === 'disabled' ? 'disabled' : result.phase === 'delivery' ? 'accepted' : 'invalid_response';
      } finally { await reader.cancel().catch(() => {}); }
    } else { await response.body?.cancel(); }
  } catch {
    metadata.outcome = deadline.aborted ? 'timeout_unknown' : 'request_failed';
  }
  metadata.durationMs = Math.max(0, now() - started);
  log(metadata);
  return metadata;
}

const worker = {
  async scheduled(event, env) { await runScheduled(event, env); },
  // A public HTTP request never triggers a sweep.
  fetch() { return new Response(null, { status: 404 }); },
};
export default worker;
