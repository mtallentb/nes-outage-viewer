# NES-Tracker

A CLI tool and web dashboard for tracking Nashville Electric Service (NES) power outages near your home in real-time.

## Features

- **CLI Mode**: One-time outage check with formatted terminal output
- **Watch Mode**: Continuous monitoring with configurable poll intervals
- **Web Dashboard**: Interactive map interface with:
  - Leaflet map showing outage locations and your home
  - Address search with typeahead
  - Customizable coordinates and search radius
  - Auto-refresh every 30 seconds
  - Nashville-wide vs. nearby outage comparison

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the project root:

```env
# Your home coordinates (defaults to 12 South Edley's)
HOME_LAT=36.122859
HOME_LNG=-86.789864

# Optional
RADIUS_MILES=1        # Search radius in miles (default: 1)
POLL_INTERVAL=5       # Poll interval in minutes for watch mode (default: 5)
PORT=3000             # Server port for dashboard (default: 3000)
```

## Usage

### Web Dashboard (Local Development)

```bash
npm run dev
```

Then open http://localhost:3000 in your browser.

### CLI (Local Development)

One-time check:
```bash
npm run dev:cli
```

Watch mode (continuous monitoring):
```bash
npm run dev:watch
```

### Production Build

```bash
npm run build
npm start
```

## Tech Stack

- TypeScript
- Node.js / Express
- Leaflet.js (mapping)
- NES Outage API
- Nominatim (address geocoding)

## Project Structure

```
src/
├── index.ts        # CLI entry point
├── server.ts       # Express server for dashboard
├── api.ts          # NES API integration
├── geo.ts          # Haversine distance calculation
├── types.ts        # TypeScript interfaces
└── public/
    └── index.html  # Web dashboard
```

## License

MIT
