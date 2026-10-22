import { handleReminderWorker } from '@/lib/notifications/reminderWorker.server';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  return handleReminderWorker(request);
}
