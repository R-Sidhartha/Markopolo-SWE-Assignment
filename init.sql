CREATE TABLE IF NOT EXISTS ticket_pools (
    event_id VARCHAR(50) PRIMARY KEY,
    total INTEGER NOT NULL,
    available INTEGER NOT NULL,
    CONSTRAINT ticket_pools_total_nonnegative CHECK (total >= 0),
    CONSTRAINT ticket_pools_available_nonnegative CHECK (available >= 0),
    CONSTRAINT ticket_pools_available_le_total CHECK (available <= total)
);

CREATE TABLE IF NOT EXISTS issued_tickets (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    ticket_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT issued_tickets_event_fk
      FOREIGN KEY (event_id) REFERENCES ticket_pools(event_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS issued_tickets_event_ticket_number_uniq
  ON issued_tickets(event_id, ticket_number);

CREATE INDEX IF NOT EXISTS issued_tickets_event_user_idx
  ON issued_tickets(event_id, user_id);