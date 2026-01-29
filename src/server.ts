import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fetchOutages, filterNearbyOutages } from './api';

const app = express();
const PORT = process.env.PORT || 3000;

// Default config from environment (optional)
const defaultConfig = {
  homeLat: parseFloat(process.env.HOME_LAT || '') || null,
  homeLng: parseFloat(process.env.HOME_LNG || '') || null,
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

    const outages = await fetchOutages();
    const nearby = filterNearbyOutages(outages, config);

    res.json({
      outages: nearby,
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

app.listen(PORT, () => {
  console.log(`NES Outage Dashboard running at http://localhost:${PORT}`);
});
