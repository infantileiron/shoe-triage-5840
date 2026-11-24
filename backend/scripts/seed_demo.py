import json

from psycopg.types.json import Jsonb

from scripts.demo_cases import ACCOUNTS, CUTOFF, SEED_PLAN, demo_rows
from src.config.settings import connect
from src.constants.domain import FEATURES
from src.models.records import SAMPLE_FIELDS, enqueue
from src.services.workbench import snapshot
from src.utils.security import password_hash


def main():
    with connect() as db:
        db.execute('SELECT pg_advisory_xact_lock(520501)')
        for username, name, role, password in ACCOUNTS:
            if not db.execute('SELECT 1 FROM accounts WHERE username=%s', (username,)).fetchone():
                db.execute('INSERT INTO accounts VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING',
                           (username, name, role, password_hash(password)))
        rows = list(demo_rows())
        with db.cursor() as cursor:
            cursor.executemany(f'''INSERT INTO samples ({SAMPLE_FIELDS})
                VALUES (%(code)s, %(received)s, %(studio)s, %(shoe)s, %(wear)s, %(glue)s, %(sole)s, %(label)s)
                ON CONFLICT (code) DO NOTHING''', rows)
        plan = db.execute('''INSERT INTO plans (name, cutoff, alpha, min_leaf, max_depth, features, created_by)
                             SELECT %s, %s, 0.026, 2, 5, %s, 'analyst'
                             WHERE NOT EXISTS (SELECT 1 FROM plans WHERE name=%s)
                             ON CONFLICT (name) DO NOTHING RETURNING id''',
                          (SEED_PLAN, CUTOFF, Jsonb(list(FEATURES)), SEED_PLAN)).fetchone()
        if plan:
            frozen, digest = snapshot(db)
            enqueue(db, plan['id'], frozen, digest, 'analyst')
        sample_keys = db.execute('SELECT code FROM samples WHERE code=ANY(%s) ORDER BY code',
                                 ([row['code'] for row in rows],)).fetchall()
    print(json.dumps({'accounts': [entry[0] for entry in ACCOUNTS], 'plan': SEED_PLAN,
                      'sample_keys': [row['code'] for row in sample_keys]}, ensure_ascii=False))


if __name__ == '__main__':
    main()
