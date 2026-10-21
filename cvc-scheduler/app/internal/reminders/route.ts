import { authorizeReminderWorker, runDisabledReminderWorker } from '@/lib/notifications/reminderWorker.server';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!authorizeReminderWorker(request.headers.get('authorization'), process.env.REMINDER_WORKER_SECRET)) return new Response(null, { status: 401 });
  try {
    const stats = await runDisabledReminderWorker();
    console.info(JSON.stringify({ event: 'assignment_reminder_sweep', ...stats }));
    return Response.json(stats, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error(JSON.stringify({ event: 'assignment_reminder_sweep', phase: 'disabled', failure: 'worker_unavailable', at: new Date().toISOString() }));
    return Response.json({ error: 'Reminder sweep unavailable. No delivery is enabled in Phase A.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
