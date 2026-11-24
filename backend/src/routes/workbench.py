from fastapi import APIRouter, Depends, HTTPException

from src.config.settings import connect
from src.constants.domain import Role
from src.controllers.exports import batch_csv, holdout_csv, tickets_csv
from src.middlewares.auth import analyst, dispatcher, identity, owner
from src.models.records import RUN_FIELDS, raw_samples
from src.schemas.inputs import BatchCreate, Decision, Plan, Receipts, Review, Sample, Ticket
from src.services import dispatch, workbench

router = APIRouter()


@router.get('/samples')
def samples(actor=Depends(identity)):
    with connect() as db:
        return raw_samples(db)


@router.post('/samples', status_code=201)
def add_sample(payload: Sample, actor=Depends(analyst)):
    with connect() as db:
        return workbench.save_sample(db, payload, actor['username'])


@router.put('/samples/{code}')
def edit_sample(code: str, payload: Sample, actor=Depends(analyst)):
    if code != payload.code:
        raise HTTPException(422, '历史工票编号不可变更')
    with connect() as db:
        return workbench.save_sample(db, payload, actor['username'], edit=True)


@router.get('/plans')
def plans(actor=Depends(identity)):
    with connect() as db:
        return db.execute('''SELECT p.* FROM plans p WHERE %s OR EXISTS (
                              SELECT 1 FROM runs r WHERE r.plan_id=p.id AND r.publication<>'draft')
                              ORDER BY p.id DESC''', (actor['role'] != Role.viewer,)).fetchall()


@router.post('/plans', status_code=201)
def add_plan(payload: Plan, actor=Depends(analyst)):
    with connect() as db:
        return workbench.create_plan(db, payload, actor['username'])


@router.post('/plans/{plan_id}/runs', status_code=202)
def execute(plan_id: int, actor=Depends(analyst)):
    with connect() as db:
        return workbench.queue_run(db, plan_id, actor['username'])


@router.get('/runs')
def runs(actor=Depends(identity)):
    with connect() as db:
        return db.execute(f'''SELECT {RUN_FIELDS} FROM runs r JOIN plans p ON p.id=r.plan_id
                             WHERE %s OR r.publication<>'draft' ORDER BY r.id DESC''',
                          (actor['role'] != Role.viewer,)).fetchall()


@router.get('/runs/{run_id}')
def run(run_id: int, actor=Depends(identity)):
    with connect() as db:
        return workbench.run_detail(db, run_id, actor)


@router.post('/runs/{run_id}/publish')
def publish(run_id: int, payload: Review, actor=Depends(owner)):
    with connect() as db:
        return workbench.publish(db, run_id, payload, actor)


@router.get('/runs/{run_id}/export')
def export_run(run_id: int, actor=Depends(identity)):
    with connect() as db:
        result = workbench.run_detail(db, run_id, actor)
    if result['state'] != 'succeeded':
        raise HTTPException(409, '评估完成后方可导出')
    return holdout_csv(result)


@router.get('/tickets')
def tickets(actor=Depends(identity)):
    with connect() as db:
        return db.execute('SELECT * FROM tickets WHERE %s OR decision IS NOT NULL ORDER BY created_at DESC, code',
                          (actor['role'] != Role.viewer,)).fetchall()


@router.post('/tickets', status_code=201)
def add_ticket(payload: Ticket, actor=Depends(analyst)):
    with connect() as db:
        return workbench.create_ticket(db, payload, actor['username'])


@router.post('/tickets/{code}/decision')
def decision(code: str, payload: Decision, actor=Depends(owner)):
    with connect() as db:
        return workbench.decide(db, code, payload, actor['username'])


@router.get('/tickets/export')
def export_tickets(actor=Depends(identity)):
    with connect() as db:
        dispatched = db.execute('SELECT * FROM tickets WHERE decision IS NOT NULL ORDER BY code').fetchall()
    return tickets_csv(dispatched)


@router.post('/batches', status_code=201)
def add_batch(payload: BatchCreate, actor=Depends(dispatcher)):
    with connect() as db:
        return dispatch.create_batch(db, payload, actor['username'])


@router.get('/batches')
def batches(actor=Depends(identity)):
    with connect() as db:
        return dispatch.list_batches(db)


@router.get('/batches/{batch_id}')
def batch(batch_id: int, actor=Depends(identity)):
    with connect() as db:
        return dispatch.batch_detail(db, batch_id)


@router.get('/batches/{batch_id}/export')
def export_batch(batch_id: int, actor=Depends(identity)):
    with connect() as db:
        return batch_csv(dispatch.batch_detail(db, batch_id))


@router.post('/batches/{batch_id}/receipts')
def receipts(batch_id: int, payload: Receipts, actor=Depends(dispatcher)):
    with connect() as db:
        return dispatch.record_receipts(db, batch_id, payload, actor['username'])


@router.get('/audit')
def audits(actor=Depends(owner)):
    with connect() as db:
        return db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 100').fetchall()
