import { OutageEvent, NearbyOutage, Config } from './types';
import { haversineDistance } from './geo';

const API_URL = 'https://utilisocial.io/datacapable/v2/p/NES/map/events';

interface ApiResponse {
  id: number;
  latitude: number;
  longitude: number;
  numPeople: number;
  status: string;
  lastUpdatedTime: number;
  cause?: string;
  etrTime?: number;
  identifier: string;
}

export async function fetchOutages(): Promise<OutageEvent[]> {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApiResponse[];

  return data.map((event) => ({
    id: event.identifier,
    lat: event.latitude,
    lng: event.longitude,
    numPeople: event.numPeople,
    status: event.status,
    lastUpdated: new Date(event.lastUpdatedTime).toISOString(),
    cause: event.cause,
    estimatedRestoration: event.etrTime ? new Date(event.etrTime).toISOString() : undefined,
  }));
}

export function filterNearbyOutages(
  outages: OutageEvent[],
  config: Config
): NearbyOutage[] {
  return outages
    .map((outage) => ({
      ...outage,
      distance: haversineDistance(
        config.homeLat,
        config.homeLng,
        outage.lat,
        outage.lng
      ),
    }))
    .filter((outage) => outage.distance <= config.radiusMiles)
    .sort((a, b) => a.distance - b.distance);
}
