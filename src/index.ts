import 'dotenv/config';
import { fetchOutages, filterNearbyOutages } from './api';
import { Config, NearbyOutage } from './types';

function loadConfig(): Config {
  const homeLat = parseFloat(process.env.HOME_LAT || '');
  const homeLng = parseFloat(process.env.HOME_LNG || '');

  if (isNaN(homeLat) || isNaN(homeLng)) {
    console.error('Error: HOME_LAT and HOME_LNG must be set in .env file');
    process.exit(1);
  }

  return {
    homeLat,
    homeLng,
    radiusMiles: parseFloat(process.env.RADIUS_MILES || '1'),
    pollIntervalMinutes: parseFloat(process.env.POLL_INTERVAL || '5'),
  };
}

function formatTimeAgo(isoString: string): string {
  const now = new Date();
  const updated = new Date(isoString);
  const diffMs = now.getTime() - updated.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function displayOutages(outages: NearbyOutage[], config: Config): void {
  console.log(
    `\nNES Outage Tracker - Checking area within ${config.radiusMiles} mile${config.radiusMiles !== 1 ? 's' : ''} of home...\n`
  );

  if (outages.length === 0) {
    console.log('No outages found nearby.\n');
    return;
  }

  console.log(`Found ${outages.length} outage${outages.length !== 1 ? 's' : ''} nearby:\n`);

  for (const outage of outages) {
    const distance = outage.distance.toFixed(1);
    const people = formatNumber(outage.numPeople).padStart(6);
    const status = outage.status.padEnd(10);
    const timeAgo = formatTimeAgo(outage.lastUpdated);

    console.log(
      `  #${outage.id} | ${distance} mi | ${people} people | ${status} | Updated ${timeAgo}`
    );
  }

  const assigned = outages.filter((o) => o.status === 'Assigned').length;
  const unassigned = outages.filter((o) => o.status !== 'Assigned').length;

  console.log(`\nStatus: ${assigned} Assigned, ${unassigned} Unassigned\n`);
}

async function checkOutages(config: Config): Promise<void> {
  try {
    const outages = await fetchOutages();
    const nearby = filterNearbyOutages(outages, config);
    displayOutages(nearby, config);
  } catch (error) {
    console.error('Error fetching outages:', error instanceof Error ? error.message : error);
  }
}

async function watchMode(config: Config): Promise<void> {
  const intervalMs = config.pollIntervalMinutes * 60 * 1000;

  console.clear();
  console.log(`Watch mode enabled - checking every ${config.pollIntervalMinutes} minute${config.pollIntervalMinutes !== 1 ? 's' : ''}`);
  console.log('Press Ctrl+C to exit\n');

  await checkOutages(config);

  setInterval(async () => {
    console.clear();
    console.log(`Watch mode - checking every ${config.pollIntervalMinutes} minute${config.pollIntervalMinutes !== 1 ? 's' : ''}`);
    console.log(`Last check: ${new Date().toLocaleTimeString()}`);
    console.log('Press Ctrl+C to exit');
    await checkOutages(config);
  }, intervalMs);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const args = process.argv.slice(2);
  const isWatchMode = args.includes('--watch') || args.includes('-w');

  if (isWatchMode) {
    await watchMode(config);
  } else {
    await checkOutages(config);
  }
}

main();
