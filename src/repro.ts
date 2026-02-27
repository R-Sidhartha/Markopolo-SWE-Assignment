import axios from "axios";
import { Pool } from "pg";

type PurchaseOk = { success: true; tickets: number[] };
type PurchaseErr = { success: false; error: string };
type PurchaseResponse = PurchaseOk | PurchaseErr;

function getArg(name: string, defaultValue: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return defaultValue;
  return arg.slice(prefix.length);
}

async function main(): Promise<void> {
  const serverUrl = getArg("server", process.env.SERVER_URL ?? "http://localhost:3000");
  const eventId = getArg("event", "RACE001");
  const concurrency = Number(getArg("concurrency", "100"));
  const quantity = Number(getArg("quantity", "8"));

  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error("concurrency must be a positive integer");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer");
  }

  const db = new Pool({
    host: "localhost",
    port: 5433,
    database: "tickets",
    user: "postgres",
    password: "postgres",
  });

  const total = 64;
  const available = 64;

  await db.query("DELETE FROM issued_tickets WHERE event_id = $1", [eventId]);
  await db.query(
    `
      INSERT INTO ticket_pools (event_id, total, available)
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id) DO UPDATE SET total = EXCLUDED.total, available = EXCLUDED.available
    `,
    [eventId, total, available],
  );

  const client = axios.create({
    baseURL: serverUrl,
    timeout: 30_000,
    validateStatus: () => true,
  });

  const startAt = Date.now();
  const requests = Array.from({ length: concurrency }, (_, i) => {
    const userId = `repro_user_${i + 1}`;
    return client.post<PurchaseResponse>("/purchase", {
      userId,
      eventId,
      quantity,
    });
  });

  const results = await Promise.allSettled(requests);
  const durationMs = Date.now() - startAt;

  let ok = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.data?.success) ok++;
    else failed++;
  }

  const poolRow = await db.query<{
    total: number;
    available: number;
  }>("SELECT total, available FROM ticket_pools WHERE event_id = $1", [eventId]);

  const issuedRow = await db.query<{ issued_count: number }>(
    "SELECT COUNT(*)::int AS issued_count FROM issued_tickets WHERE event_id = $1",
    [eventId],
  );

  const duplicates = await db.query<{ ticket_number: number; c: number }>(
    `
      SELECT ticket_number, COUNT(*)::int AS c
      FROM issued_tickets
      WHERE event_id = $1
      GROUP BY ticket_number
      HAVING COUNT(*) > 1
      ORDER BY ticket_number ASC
      LIMIT 25
    `,
    [eventId],
  );

  const totalNow = poolRow.rows[0]?.total ?? NaN;
  const availableNow = poolRow.rows[0]?.available ?? NaN;
  const issuedCount = issuedRow.rows[0]?.issued_count ?? 0;

  console.log("\n=== Repro Summary ===");
  console.log({
    serverUrl,
    eventId,
    concurrency,
    quantity,
    requestedTickets: concurrency * quantity,
    okPurchases: ok,
    failedPurchases: failed,
    durationMs,
  });

  console.log("\n=== Postgres State ===");

  console.log({
    total: totalNow,
    available: availableNow,
    issuedCount,
    soldComputed: Number.isFinite(totalNow) && Number.isFinite(availableNow) ? totalNow - availableNow : NaN,
  });

  console.log("\n=== Duplicate Ticket Numbers (first 25) ===");
  console.table(duplicates.rows);

  await db.end();

  if (duplicates.rows.length === 0 && availableNow >= 0 && issuedCount <= totalNow) {
    console.log(
      "\nNo duplicates / oversell observed. This likely means the service has already been fixed.",
    );
  } else {
    console.log("\nBUG REPRODUCED: duplicates and/or overselling detected.");
  }
}

main().catch((err) => {
  console.error("Repro script failed:", err);
  process.exit(1);
});

