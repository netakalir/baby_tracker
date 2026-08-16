/** The zone the viewing device is set to, resolved client-side (see todayDate.ts). */
const DEVICE_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

const deviceTimeFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: DEVICE_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Formats an ISO/UTC timestamp as a device-local HH:MM string (e.g. "23:30"). */
export function formatDeviceTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return deviceTimeFormatter.format(date)
}

const MINUTES_IN_HOUR = 60

/**
 * Formats an elapsed millisecond span as a live stopwatch string: "M:SS" under
 * an hour (e.g. "7:05"), "H:MM:SS" once it passes an hour (e.g. "1:23:45").
 * Used for the running duration shown inside an active timer button.
 */
export function formatStopwatch(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/**
 * Formats the gap between two ISO/UTC timestamps as a short Hebrew duration
 * (e.g. "7ש׳ 30ד׳", "45ד׳", "3ש׳"). Uses absolute wall-clock elapsed time, so an
 * overnight event that crosses midnight is measured correctly across both days.
 */
export function formatDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
  const hours = Math.floor(totalMinutes / MINUTES_IN_HOUR)
  const minutes = totalMinutes % MINUTES_IN_HOUR
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}ש׳`)
  if (minutes > 0 || hours === 0) parts.push(`${minutes}ד׳`)
  return parts.join(' ')
}
