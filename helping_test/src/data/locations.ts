/**
 * Calculates straight line distance in km between two GPS coordinates using the Haversine formula
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Dynamically resolves coordinates for a location string or parses coordinates.
 * Returns null if location cannot be accurately resolved.
 */
export async function resolveLocationCoordinates(rawInput: string): Promise<{
  name: string;
  lat: number;
  lng: number;
} | null> {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 1. Direct coordinate check: "28.5355, 77.3910"
  const coordMatch = trimmed.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
  if (coordMatch) {
    return {
      name: `GPS (${coordMatch[1]}, ${coordMatch[2]})`,
      lat: parseFloat(coordMatch[1]),
      lng: parseFloat(coordMatch[2])
    };
  }

  // 2. Dynamic geocoding via OpenStreetMap Nominatim API (Free, global, no hardcoded cities)
  try {
    const encoded = encodeURIComponent(trimmed);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HelpingHand-WhatsApp-Bot/1.0'
      },
      signal: AbortSignal.timeout(4000)
    });

    if (response.ok) {
      const data = (await response.json()) as Array<{
        display_name: string;
        lat: string;
        lon: string;
      }>;

      if (data && data.length > 0) {
        return {
          name: data[0].display_name.split(',').slice(0, 3).join(', '),
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    }
  } catch (err) {
    console.warn(`[Geocoding] Dynamic lookup failed for "${trimmed}":`, err);
  }

  return null;
}
