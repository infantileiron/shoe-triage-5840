CREATE TABLE IF NOT EXISTS batches (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    station text NOT NULL CHECK (station IN ('reglue', 'resole', 'retire')),
    digest text NOT NULL,
    created_by text NOT NULL REFERENCES accounts(username),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS batch_items (
    batch_id bigint NOT NULL REFERENCES batches(id),
    ticket_code text NOT NULL REFERENCES tickets(code),
    PRIMARY KEY (ticket_code),
    UNIQUE (batch_id, ticket_code)
);
CREATE INDEX IF NOT EXISTS batch_items_batch ON batch_items (batch_id);
CREATE TABLE IF NOT EXISTS receipts (
    batch_id bigint NOT NULL,
    ticket_code text NOT NULL,
    received_by text NOT NULL REFERENCES accounts(username),
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (batch_id, ticket_code),
    FOREIGN KEY (batch_id, ticket_code) REFERENCES batch_items (batch_id, ticket_code)
);
