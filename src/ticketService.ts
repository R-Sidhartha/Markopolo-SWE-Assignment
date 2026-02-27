import { Pool } from "pg";

interface TicketPool {
  event_id: string;
  total: number;
  available: number;
}

const pool = new Pool({
  host: "localhost",
  port: 5433,
  database: "tickets",
  user: "postgres",
  password: "postgres",
});

export async function purchaseTickets(
  userId: string,
  eventId: string,
  quantity: number,
): Promise<number[]> {
  const issued = await pool.query<{ ticket_number: number }>(
    `
      WITH updated AS (
        UPDATE ticket_pools
        SET available = available - $1
        WHERE event_id = $2 AND available >= $1
        RETURNING event_id, total, available
      ),
      ins AS (
        INSERT INTO issued_tickets (event_id, user_id, ticket_number)
        SELECT
          updated.event_id,
          $3,
          gs
        FROM updated,
        generate_series(
          updated.total - (updated.available + $1) + 1,
          updated.total - updated.available
        ) AS gs
        RETURNING ticket_number
      )
      SELECT ticket_number
      FROM ins
      ORDER BY ticket_number ASC
    `,
    [quantity, eventId, userId],
  );

  if (issued.rows.length === quantity) {
    return issued.rows.map((r) => r.ticket_number);
  }

  const availableResult = await pool.query<TicketPool>(
    "SELECT * FROM ticket_pools WHERE event_id = $1",
    [eventId],
  );

  if (availableResult.rows.length === 0) {
    throw new Error("Event not found");
  }

  throw new Error("Not enough tickets available");
}

export async function getPool(): Promise<Pool> {
  return pool;
}
