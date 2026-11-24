import hashlib
import json

from fastapi import HTTPException
from psycopg.errors import UniqueViolation
from psycopg.types.json import Jsonb

from src.constants.domain import Role
from src.models.records import RUN_FIELDS, SAMPLE_FIELDS, audit, encode_dates, enqueue, raw_samples
from src.services.cart import classify


def snapshot(db):
    rows = [encode_dates(row) for row in raw_samples(db)]
    canonical = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return rows, hashlib.sha256(canonical.encode()).hexdigest()


def save_sample(db, payload, actor, edit=False):
    row = payload.model_dump()
    if edit:
        saved = db.execute(f'''UPDATE samples SET received=%(received)s, studio=%(studio)s,
                              shoe=%(shoe)s, wear=%(wear)s, glue=%(glue)s, sole=%(sole)s, label=%(label)s
                              WHERE code=%(code)s RETURNING {SAMPLE_FIELDS}''', row).fetchone()
        if not saved:
            raise HTTPException(404, '工票不存在')
    else:
        try:
            saved = db.execute(f'''INSERT INTO samples ({SAMPLE_FIELDS}) VALUES (%(code)s, %(received)s,
                                   %(studio)s, %(shoe)s, %(wear)s, %(glue)s, %(sole)s, %(label)s)
                                   RETURNING {SAMPLE_FIELDS}''', row).fetchone()
        except UniqueViolation as exc:
            raise HTTPException(409, '历史工票编号已存在') from exc
    audit(db, actor, 'sample.update' if edit else 'sample.create', payload.code)
    return saved


def create_plan(db, payload, actor):
    row = {**payload.model_dump(), 'features': Jsonb(payload.features), 'actor': actor}
    try:
        plan = db.execute('''INSERT INTO plans (name, cutoff, alpha, min_leaf, max_depth, features, created_by)
                             VALUES (%(name)s, %(cutoff)s, %(alpha)s, %(min_leaf)s, %(max_depth)s,
                             %(features)s, %(actor)s) RETURNING *''', row).fetchone()
    except UniqueViolation as exc:
        raise HTTPException(409, '方案版本名称已存在') from exc
    audit(db, actor, 'plan.create', plan['id'])
    return plan


def queue_run(db, plan_id, actor):
    if not db.execute('SELECT id FROM plans WHERE id=%s', (plan_id,)).fetchone():
        raise HTTPException(404, '方案不存在')
    rows, digest = snapshot(db)
    result = enqueue(db, plan_id, rows, digest, actor)
    audit(db, actor, 'run.queue', result['id'])
    return result


def run_detail(db, run_id, actor):
    row = db.execute(f'''SELECT {RUN_FIELDS}, r.report FROM runs r JOIN plans p ON p.id=r.plan_id
                        WHERE r.id=%s AND (%s OR r.publication<>'draft')''',
                     (run_id, actor['role'] != Role.viewer)).fetchone()
    if not row:
        raise HTTPException(404, '评估报告不存在或未发布')
    return row


def publish(db, run_id, payload, actor):
    db.execute('SELECT pg_advisory_xact_lock(5205)')
    row = db.execute('SELECT state, publication FROM runs WHERE id=%s FOR UPDATE', (run_id,)).fetchone()
    if not row:
        raise HTTPException(404, '评估报告不存在')
    if row['state'] != 'succeeded' or row['publication'] != 'draft':
        raise HTTPException(409, '只能发布已完成且待复核的评估')
    db.execute("UPDATE runs SET publication='archived' WHERE publication='active'")
    db.execute("""UPDATE runs SET publication='active', review_note=%s, published_at=now()
                  WHERE id=%s""", (payload.note, run_id))
    audit(db, actor['username'], 'run.publish', run_id)
    return run_detail(db, run_id, actor)


def create_ticket(db, payload, actor):
    # Share the publication lock so each ticket sees one unambiguous active model.
    db.execute('SELECT pg_advisory_xact_lock_shared(5205)')
    active = db.execute("SELECT id, report FROM runs WHERE publication='active'").fetchone()
    if not active:
        raise HTTPException(409, '暂无已生效的规则，请先由主管复核发布')
    row = payload.model_dump()
    predicted, steps, counts = classify(active['report']['tree'], row)
    row.update(run_id=active['id'], predicted=predicted, path=Jsonb({'steps': steps, 'counts': counts}), actor=actor)
    try:
        saved = db.execute('''INSERT INTO tickets (code, run_id, studio, shoe, wear, glue, sole, prediction,
                             path, created_by) VALUES (%(code)s, %(run_id)s, %(studio)s, %(shoe)s, %(wear)s,
                             %(glue)s, %(sole)s, %(predicted)s, %(path)s, %(actor)s) RETURNING *''', row).fetchone()
    except UniqueViolation as exc:
        raise HTTPException(409, '分诊单编号已存在') from exc
    audit(db, actor, 'ticket.create', payload.code)
    return saved


def decide(db, code, payload, actor):
    saved = db.execute('''UPDATE tickets SET decision=%s, note=%s, reviewed_by=%s, reviewed_at=now()
                         WHERE code=%s AND decision IS NULL RETURNING *''',
                       (payload.decision, payload.note, actor, code)).fetchone()
    if not saved:
        exists = db.execute('SELECT code FROM tickets WHERE code=%s', (code,)).fetchone()
        raise HTTPException(409 if exists else 404, '分诊单已签发' if exists else '分诊单不存在')
    audit(db, actor, 'ticket.decide', code)
    return saved
