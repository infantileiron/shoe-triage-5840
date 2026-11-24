import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from scripts import seed_demo
from src.config.settings import cache, connect
from src.middlewares.http import request_id
from src.routes import auth, workbench


@asynccontextmanager
async def lifespan(app):
    with connect() as db:
        db.execute('SELECT pg_advisory_xact_lock(520500)')
        for sql in sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql')):
            db.execute(sql.read_text())
    if os.getenv('SEED_DEMO', 'true').lower() == 'true':
        try:
            seed_demo.main()
        except Exception:
            logging.exception('Demo seed failed; use python -m scripts.seed_demo to retry')
    yield


app = FastAPI(title='照台舞服 · 返修分诊', lifespan=lifespan)
app.middleware('http')(request_id)
app.include_router(auth.router)
app.include_router(workbench.router)


@app.exception_handler(RequestValidationError)
async def invalid(request: Request, exc: RequestValidationError):
    issue = exc.errors()[0]
    field = issue['loc'][-1]
    return JSONResponse({'detail': f'请检查「{field}」的取值', 'field': field}, 422)


@app.get('/health')
def health():
    with connect() as db:
        db.execute('SELECT 1')
    cache.ping()
    return {'status': 'ok'}
