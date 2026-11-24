import hashlib
import json

from fastapi import HTTPException

from src.models.records import audit

# Serializes batch creation so two concurrent batches can never share a ticket.
BATCH_LOCK = 520506
ITEM_FIELDS = ('code', 'run_id', 'studio', 'shoe', 'prediction', 'decision', 'note', 'reviewed_by')


def content_digest(items):
    canonical = json.dumps(items, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode()).hexdigest()


def create_batch(db, payload, actor):
    db.execute('SELECT pg_advisory_xact_lock(%s)', (BATCH_LOCK,))
    rows = db.execute('''SELECT code, run_id, studio, shoe, prediction, decision, note, reviewed_by
                         FROM tickets
                         WHERE decision=%s AND code NOT IN (SELECT ticket_code FROM batch_items)
                         ORDER BY code''', (payload.station,)).fetchall()
    if not rows:
        raise HTTPException(409, '该工位暂无待分批的已签发分诊单')
    items = [{key: row[key] for key in ITEM_FIELDS} for row in rows]
    batch = db.execute('''INSERT INTO batches (station, digest, created_by) VALUES (%s, %s, %s)
                          RETURNING *''',
                       (payload.station, content_digest(items), actor)).fetchone()
    with db.cursor() as cursor:
        cursor.executemany('INSERT INTO batch_items (batch_id, ticket_code) VALUES (%s, %s)',
                           [(batch['id'], row['code']) for row in rows])
    audit(db, actor, 'batch.create', f"批次 #{batch['id']} · {len(rows)} 张")
    return {**batch, 'total': len(rows), 'received': 0}


def list_batches(db):
    batches = db.execute('''SELECT b.*, COUNT(i.ticket_code) AS total, COUNT(r.ticket_code) AS received
                            FROM batches b
                            JOIN batch_items i ON i.batch_id=b.id
                            LEFT JOIN receipts r ON r.batch_id=i.batch_id AND r.ticket_code=i.ticket_code
                            GROUP BY b.id ORDER BY b.id DESC''').fetchall()
    pending = db.execute('''SELECT decision AS station, COUNT(*) AS n FROM tickets
                            WHERE decision IS NOT NULL
                            AND code NOT IN (SELECT ticket_code FROM batch_items)
                            GROUP BY decision''').fetchall()
    return {'batches': batches, 'unbatched': {row['station']: row['n'] for row in pending}}


def batch_detail(db, batch_id):
    batch = db.execute('SELECT * FROM batches WHERE id=%s', (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(404, '批次不存在')
    items = db.execute('''SELECT t.code, t.run_id, t.studio, t.shoe, t.prediction, t.decision, t.note,
                          t.reviewed_by, t.reviewed_at, r.received_by, r.received_at
                          FROM batch_items i
                          JOIN tickets t ON t.code=i.ticket_code
                          LEFT JOIN receipts r ON r.batch_id=i.batch_id AND r.ticket_code=i.ticket_code
                          WHERE i.batch_id=%s ORDER BY t.code''', (batch_id,)).fetchall()
    return {**batch, 'items': items}


def record_receipts(db, batch_id, payload, actor):
    batch = db.execute('SELECT id FROM batches WHERE id=%s FOR UPDATE', (batch_id,)).fetchone()
    if not batch:
        raise HTTPException(404, '批次不存在')
    codes = payload.codes
    membership = {row['ticket_code']: row['batch_id'] for row in db.execute(
        'SELECT ticket_code, batch_id FROM batch_items WHERE ticket_code=ANY(%s)', (codes,)).fetchall()}
    mine = [code for code in codes if membership.get(code) == batch_id]
    misplaced = [{'code': code, 'batch': membership[code]} for code in codes
                 if code in membership and membership[code] != batch_id]
    stray = [code for code in codes if code not in membership]
    unbatched, unsigned, unknown = [], [], []
    if stray:
        found = {row['code']: row['decision'] for row in db.execute(
            'SELECT code, decision FROM tickets WHERE code=ANY(%s)', (stray,)).fetchall()}
        for code in stray:
            if code not in found:
                unknown.append(code)
            elif found[code] is None:
                unsigned.append(code)
            else:
                unbatched.append(code)
    recorded_set = set()
    if mine:
        recorded_set = {row['ticket_code'] for row in db.execute(
            '''INSERT INTO receipts (batch_id, ticket_code, received_by)
               SELECT %s, code, %s FROM unnest(%s::text[]) AS t(code)
               ON CONFLICT (batch_id, ticket_code) DO NOTHING RETURNING ticket_code''',
            (batch_id, actor, mine)).fetchall()}
    recorded = [code for code in mine if code in recorded_set]
    if recorded:
        audit(db, actor, 'receipt.record', f'批次 #{batch_id} · 新收 {len(recorded)} 张')
    return {'recorded': recorded, 'duplicate': [code for code in mine if code not in recorded_set],
            'misplaced': misplaced, 'unbatched': unbatched, 'unsigned': unsigned, 'unknown': unknown}
