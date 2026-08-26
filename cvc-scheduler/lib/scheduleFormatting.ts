const clockTimePattern = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/;

export function formatScheduleDate(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return value;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatScheduleClockTime(value: string | null) {
  if (!value) return null;
  const match = clockTimePattern.exec(value.trim());
  if (!match) return value;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = match[3] === undefined ? 0 : Number(match[3]);
  if (hour > 23 || minute > 59 || second > 59) return value;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute, second)));
}

export function formatScheduleClockRange(
  startTime: string | null,
  endTime: string | null,
) {
  const start = formatScheduleClockTime(startTime);
  if (!start) return null;
  const end = formatScheduleClockTime(endTime);
  return end ? `${start} – ${end}` : start;
}
