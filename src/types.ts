export interface OutageEvent {
  id: string;
  lat: number;
  lng: number;
  numPeople: number;
  status: string;
  lastUpdated: string;
  cause?: string;
  estimatedRestoration?: string;
}

export interface NearbyOutage extends OutageEvent {
  distance: number;
}

export interface Config {
  homeLat: number;
  homeLng: number;
  radiusMiles: number;
  pollIntervalMinutes: number;
}
