const ISRAEL_TIME_ZONE = 'Asia/Jerusalem'

const israelTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: ISRAEL_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Formats an ISO/UTC timestamp as an Israel-local HH:MM string (e.g. "23:30"). */
export function formatIsraelTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return israelTimeFormatter.format(date)
}
