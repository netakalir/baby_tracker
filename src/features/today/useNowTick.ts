import { useEffect, useState } from 'react'

/**
 * A once-a-second clock, live only while `active`. Returns the current time as
 * epoch milliseconds; while `active` it advances every second, and while
 * inactive it holds its last value (no interval, no re-render).
 *
 * This lets a view drive a live elapsed readout — a running timer's arc and
 * stopwatch — without paying for an interval, or a wasted re-render, on any
 * second where nothing is running. Lift it to the common parent of the pieces
 * that share the tick so a single interval feeds them all, rather than each
 * owning its own.
 */
export function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    // Snap to the present the instant a timer starts (state may be stale from a
    // previous run), then advance once a second until it stops or unmounts.
    setNow(Date.now())
    const intervalId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(intervalId)
  }, [active])

  return now
}
