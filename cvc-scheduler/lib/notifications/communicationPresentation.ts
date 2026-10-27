// Display formatting only. Never used for eligibility, history filtering or delivery.
export function projectDateKey(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function projectDateLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function projectTimeLabel(value: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value));
}

export function projectTimestampLabel(value: string, timezone: string) {
  return `${projectDateLabel(value, timezone)} · ${projectTimeLabel(value, timezone)}`;
}

// Relative labels use the server observation already displayed on the page, not
// the browser's timezone/clock, so SSR/hydration and DST calendar days agree.
export function observedProjectDay(value: string, timezone: string, observedAt: string) {
  const difference = (Date.parse(`${projectDateKey(value, timezone)}T00:00Z`) - Date.parse(`${projectDateKey(observedAt, timezone)}T00:00Z`)) / 86_400_000;
  return difference === 0 ? 'Today' : difference === 1 ? 'Tomorrow' : projectDateLabel(value, timezone);
}

export function communicationStatusLabel(state: string) {
  return ({ ready: 'Ready', sending: 'Sending / outcome pending', sent: 'Sent', failed: 'Failed', unknown: 'Unknown — needs review', excluded: 'Not sent — eligibility changed' })[state] ?? 'Status unavailable';
}

export function communicationStatusTone(state: string) {
  return state === 'sent' || state === 'on' ? 'positive' : state === 'failed' ? 'failure' : state === 'unknown' ? 'attention' : state === 'sending' || state === 'scheduled' || state === 'retry_scheduled' ? 'info' : 'neutral';
}
