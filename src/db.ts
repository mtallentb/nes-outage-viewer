import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS outage_snapshots (
        id SERIAL PRIMARY KEY,
        snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        outage_id VARCHAR(100) NOT NULL,
        status VARCHAR(50),
        num_people INTEGER NOT NULL,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_time ON outage_snapshots(snapshot_time);
      CREATE INDEX IF NOT EXISTS idx_snapshots_outage_id ON outage_snapshots(outage_id);
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

export async function saveSnapshot(outages: Array<{ id: string; status: string; numPeople: number; lat: number; lng: number }>) {
  if (outages.length === 0) return;

  const client = await pool.connect();
  try {
    const now = new Date();
    const values: any[] = [];
    const placeholders: string[] = [];

    outages.forEach((outage, i) => {
      const offset = i * 6;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
      values.push(now, outage.id, outage.status, outage.numPeople, outage.lat, outage.lng);
    });

    await client.query(
      `INSERT INTO outage_snapshots (snapshot_time, outage_id, status, num_people, lat, lng) VALUES ${placeholders.join(', ')}`,
      values
    );
  } finally {
    client.release();
  }
}

export interface TrendData {
  timeRange: { start: Date; end: Date };
  resolutionRate: number; // outages resolved per hour
  netPeopleChange: number; // change in people affected
  dataPoints: Array<{
    time: Date;
    totalOutages: number;
    totalPeopleAffected: number;
  }>;
}

export async function getTrends(hoursBack: number = 6): Promise<TrendData | null> {
  const client = await pool.connect();
  try {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Get distinct snapshot times
    const snapshotTimesResult = await client.query(
      `SELECT DISTINCT snapshot_time FROM outage_snapshots
       WHERE snapshot_time >= $1
       ORDER BY snapshot_time`,
      [since]
    );

    if (snapshotTimesResult.rows.length < 2) {
      return null; // Need at least 2 snapshots for trends
    }

    const snapshotTimes = snapshotTimesResult.rows.map(r => r.snapshot_time);
    const firstTime = snapshotTimes[0];
    const lastTime = snapshotTimes[snapshotTimes.length - 1];

    // Get outage IDs from first snapshot
    const firstSnapshotResult = await client.query(
      `SELECT DISTINCT outage_id FROM outage_snapshots WHERE snapshot_time = $1`,
      [firstTime]
    );
    const firstOutageIds = new Set(firstSnapshotResult.rows.map(r => r.outage_id));

    // Get outage IDs from last snapshot
    const lastSnapshotResult = await client.query(
      `SELECT DISTINCT outage_id FROM outage_snapshots WHERE snapshot_time = $1`,
      [lastTime]
    );
    const lastOutageIds = new Set(lastSnapshotResult.rows.map(r => r.outage_id));

    // Count resolved (in first but not in last)
    let resolvedCount = 0;
    firstOutageIds.forEach(id => {
      if (!lastOutageIds.has(id)) resolvedCount++;
    });

    // Calculate hours elapsed
    const hoursElapsed = (lastTime.getTime() - firstTime.getTime()) / (1000 * 60 * 60);
    const resolutionRate = hoursElapsed > 0 ? resolvedCount / hoursElapsed : 0;

    // Get people affected at each snapshot
    const dataPointsResult = await client.query(
      `SELECT snapshot_time, COUNT(DISTINCT outage_id) as total_outages, SUM(num_people) as total_people
       FROM outage_snapshots
       WHERE snapshot_time >= $1
       GROUP BY snapshot_time
       ORDER BY snapshot_time`,
      [since]
    );

    const dataPoints = dataPointsResult.rows.map(r => ({
      time: r.snapshot_time,
      totalOutages: parseInt(r.total_outages),
      totalPeopleAffected: parseInt(r.total_people)
    }));

    // Net change in people affected
    const firstPeople = dataPoints[0]?.totalPeopleAffected || 0;
    const lastPeople = dataPoints[dataPoints.length - 1]?.totalPeopleAffected || 0;
    const netPeopleChange = lastPeople - firstPeople;

    return {
      timeRange: { start: firstTime, end: lastTime },
      resolutionRate,
      netPeopleChange,
      dataPoints
    };
  } finally {
    client.release();
  }
}

export default pool;
