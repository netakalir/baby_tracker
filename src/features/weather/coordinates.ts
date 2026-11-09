import { z } from 'zod'

/**
 * A latitude/longitude pair. Throughout the weather feature, coordinates are
 * rounded to one decimal (~11 km) before they are used for anything — a network
 * request, a query key, or local storage — so a precise device position never
 * leaves the function that read it.
 */
export interface Coordinates {
  latitude: number
  longitude: number
}

/** Zod shape for a valid coordinate pair (shared by every stored location). */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

/** Rounds a single coordinate to one decimal place. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

/** Rounds both coordinates to one decimal — the only precision we ever send or keep. */
export function roundCoordinates({ latitude, longitude }: Coordinates): Coordinates {
  return { latitude: roundToOneDecimal(latitude), longitude: roundToOneDecimal(longitude) }
}
