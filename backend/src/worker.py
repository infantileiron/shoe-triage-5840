import logging
from pathlib import Path
from time import sleep

from psycopg.types.json import Jsonb

from src.config.settings import connect
from src.services.cart import evaluate

HEARTBEAT = Path('/artifacts/worker.heartbeat')


def claim():
    with connect() as db:
        return db.execute('''WITH next AS (
            SELECT id FROM runs WHERE state='queued' OR (state='running' AND lease_until < now())
            ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED
        ) UPDATE runs r SET state='running', lease_until=now() + interval '3 minutes'
          FROM next, plans p WHERE r.id=next.id AND p.id=r.plan_id
          RETURNING r.id, r.snapshot, r.lease_until, p.cutoff, p.alpha, p.min_leaf,
                    p.max_depth, p.features''').fetchone()


def process(run):
    report, error = None, None
    try:
        report = evaluate(run['snapshot'], run)
    except ValueError as exc:
        error = str(exc)
    except Exception:
        logging.exception('Calculation failed: %s', run['id'])
        error = '计算中断，请重跑此方案'
    with connect() as db:
        db.execute('''UPDATE runs SET state=%s, report=%s, error=%s, finished_at=now(), lease_until=NULL
                      WHERE id=%s AND state='running' AND lease_until=%s''',
                   ('failed' if error else 'succeeded', Jsonb(report) if report else None,
                    error, run['id'], run['lease_until']))


def main():
    while True:
        try:
            run = claim()
            HEARTBEAT.touch()
            if run:
                process(run)
            else:
                sleep(1)
        except Exception:
            logging.exception('Queue unavailable, retrying')
            sleep(3)


if __name__ == '__main__':
    main()
