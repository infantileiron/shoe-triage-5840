CREATE TABLE IF NOT EXISTS accounts (
    username text PRIMARY KEY,
    name text NOT NULL,
    role text NOT NULL CHECK (role IN ('owner', 'analyst', 'viewer')),
    password_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS samples (
    code text PRIMARY KEY,
    received date NOT NULL,
    studio text NOT NULL,
    shoe text NOT NULL,
    wear integer NOT NULL CHECK (wear BETWEEN 0 AND 100),
    glue integer NOT NULL CHECK (glue BETWEEN 0 AND 350),
    sole text NOT NULL CHECK (sole IN ('intact', 'thin', 'cracked')),
    label text NOT NULL CHECK (label IN ('reglue', 'resole', 'retire'))
);
CREATE TABLE IF NOT EXISTS plans (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE,
    cutoff date NOT NULL,
    alpha double precision NOT NULL CHECK (alpha BETWEEN 0 AND 1),
    min_leaf integer NOT NULL CHECK (min_leaf BETWEEN 1 AND 30),
    max_depth integer NOT NULL CHECK (max_depth BETWEEN 1 AND 8),
    features jsonb NOT NULL,
    created_by text NOT NULL REFERENCES accounts(username),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    plan_id bigint NOT NULL REFERENCES plans(id),
    state text NOT NULL CHECK (state IN ('queued', 'running', 'succeeded', 'failed')),
    sample_digest text NOT NULL,
    snapshot jsonb NOT NULL,
    report jsonb,
    error text,
    publication text NOT NULL DEFAULT 'draft' CHECK (publication IN ('draft', 'active', 'archived')),
    review_note text,
    created_by text NOT NULL REFERENCES accounts(username),
    created_at timestamptz NOT NULL DEFAULT now(),
    lease_until timestamptz,
    finished_at timestamptz,
    published_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS runs_one_active ON runs (publication) WHERE publication='active';
CREATE INDEX IF NOT EXISTS runs_queue ON runs (id) WHERE state='queued';
CREATE TABLE IF NOT EXISTS tickets (
    code text PRIMARY KEY,
    run_id bigint NOT NULL REFERENCES runs(id),
    studio text NOT NULL,
    shoe text NOT NULL,
    wear integer NOT NULL CHECK (wear BETWEEN 0 AND 100),
    glue integer NOT NULL CHECK (glue BETWEEN 0 AND 350),
    sole text NOT NULL CHECK (sole IN ('intact', 'thin', 'cracked')),
    prediction text NOT NULL CHECK (prediction IN ('reglue', 'resole', 'retire')),
    path jsonb NOT NULL,
    decision text CHECK (decision IN ('reglue', 'resole', 'retire')),
    note text,
    reviewed_by text REFERENCES accounts(username),
    reviewed_at timestamptz,
    created_by text NOT NULL REFERENCES accounts(username),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    happened_at timestamptz NOT NULL DEFAULT now(),
    actor text NOT NULL,
    action text NOT NULL,
    subject text NOT NULL
);
