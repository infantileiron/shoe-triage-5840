from datetime import date

from psycopg.types.json import Jsonb

SAMPLE_FIELDS = 'code, received, studio, shoe, wear, glue, sole, label'
RUN_FIELDS = '''r.id, r.plan_id, p.name AS plan_name, p.cutoff, p.alpha, p.min_leaf,
                p.max_depth, p.features, r.state, r.sample_digest, r.error,
                r.publication, r.review_note, r.created_at, r.finished_at, r.published_at'''


def raw_samples(db):
    return db.execute(f'SELECT {SAMPLE_FIELDS} FROM samples ORDER BY received, code').fetchall()


def encode_dates(row):
    return {key: value.isoformat() if isinstance(value, date) else value for key, value in row.items()}


def audit(db, actor, action, subject):
    db.execute('INSERT INTO audit (actor, action, subject) VALUES (%s, %s, %s)',
               (actor, action, str(subject)))


def enqueue(db, plan_id, snapshot, digest, actor):
    return db.execute('''INSERT INTO runs (plan_id, state, snapshot, sample_digest, created_by)
                         VALUES (%s, 'queued', %s, %s, %s) RETURNING id, state''',
                      (plan_id, Jsonb(snapshot), digest, actor)).fetchone()
