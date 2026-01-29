import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fetchOutages, filterNearbyOutages } from './api';
import { Config } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

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

const config = loadConfig();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint for outages
app.get('/api/outages', async (_req, res) => {
  try {
    const outages = await fetchOutages();
    const nearby = filterNearbyOutages(outages, config);

    res.json({
      outages: nearby,
      config: {
        homeLat: config.homeLat,
        homeLng: config.homeLng,
        radiusMiles: config.radiusMiles,
      },
    });
  } catch (error) {
    console.error('Error fetching outages:', error);
    res.status(500).json({ error: 'Failed to fetch outages' });
  }
});

app.listen(PORT, () => {
  console.log(`NES Outage Dashboard running at http://localhost:${PORT}`);
  console.log(`Monitoring ${config.radiusMiles} mile radius around (${config.homeLat}, ${config.homeLng})`);
});
