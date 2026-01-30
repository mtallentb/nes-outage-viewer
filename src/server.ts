import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fetchOutages, filterNearbyOutages } from './api';
import { initDb, saveSnapshot, getTrends } from './db';

const app = express();
const PORT = process.env.PORT || 3000;
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Default config - 12 South Edley's
const EDLEYS_12_SOUTH = { lat: 36.122859, lng: -86.789864 };

const defaultConfig = {
  homeLat: parseFloat(process.env.HOME_LAT || '') || EDLEYS_12_SOUTH.lat,
  homeLng: parseFloat(process.env.HOME_LNG || '') || EDLEYS_12_SOUTH.lng,
  radiusMiles: parseFloat(process.env.RADIUS_MILES || '1'),
};

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for default config
app.get('/api/config', (_req, res) => {
  res.json({
    homeLat: defaultConfig.homeLat,
    homeLng: defaultConfig.homeLng,
    radiusMiles: defaultConfig.radiusMiles,
  });
});

// API endpoint for outages
app.get('/api/outages', async (req, res) => {
  try {
    const homeLat = parseFloat(req.query.lat as string);
    const homeLng = parseFloat(req.query.lng as string);
    const radiusMiles = parseFloat(req.query.radius as string) || 1;

    if (isNaN(homeLat) || isNaN(homeLng)) {
      res.status(400).json({ error: 'lat and lng query parameters are required' });
      return;
    }

    const config = {
      homeLat,
      homeLng,
      radiusMiles,
      pollIntervalMinutes: 5,
    };

    const allOutages = await fetchOutages();
    const nearby = filterNearbyOutages(allOutages, config);

    // Calculate totals for all of Nashville
    const totalEvents = allOutages.length;
    const totalPeopleAffected = allOutages.reduce((sum, o) => sum + o.numPeople, 0);

    // Calculate totals within radius
    const nearbyEvents = nearby.length;
    const nearbyPeopleAffected = nearby.reduce((sum, o) => sum + o.numPeople, 0);

    res.json({
      outages: nearby,
      totals: {
        nashville: {
          events: totalEvents,
          peopleAffected: totalPeopleAffected,
        },
        nearby: {
          events: nearbyEvents,
          peopleAffected: nearbyPeopleAffected,
        },
      },
      config: {
        homeLat,
        homeLng,
        radiusMiles,
      },
    });
  } catch (error) {
    console.error('Error fetching outages:', error);
    res.status(500).json({ error: 'Failed to fetch outages' });
  }
});

// API endpoint for trends
app.get('/api/trends', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 6;
    const trends = await getTrends(hours);

    if (!trends) {
      res.json({
        message: 'Not enough data yet. Trends require at least 2 snapshots.',
        dataPoints: []
      });
      return;
    }

    res.json(trends);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// Take a snapshot of current outages
async function takeSnapshot() {
  try {
    const outages = await fetchOutages();
    await saveSnapshot(outages.map(o => ({
      id: o.id,
      status: o.status,
      numPeople: o.numPeople,
      lat: o.lat,
      lng: o.lng
    })));
    console.log(`Snapshot saved: ${outages.length} outages`);
  } catch (error) {
    console.error('Failed to save snapshot:', error);
  }
}

// Start server
async function start() {
  // Initialize database if DATABASE_URL is set
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      // Take initial snapshot
      await takeSnapshot();
      // Schedule periodic snapshots
      setInterval(takeSnapshot, SNAPSHOT_INTERVAL_MS);
    } catch (error) {
      console.error('Database initialization failed:', error);
      console.log('Continuing without trend tracking...');
    }
  } else {
    console.log('DATABASE_URL not set - trend tracking disabled');
  }

  app.listen(PORT, () => {
    console.log(`NES Outage Dashboard running at http://localhost:${PORT}`);
  });
}

start();
