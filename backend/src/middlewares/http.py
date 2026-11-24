import logging
from uuid import uuid4

from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


async def request_id(request: Request, call_next):
    trace = uuid4().hex
    try:
        response = await call_next(request)
    except Exception:
        logger.exception('Request failed: %s', trace)
        response = JSONResponse({'detail': '暂时无法完成操作，请稍后重试', 'request_id': trace}, 500)
    response.headers['X-Request-Id'] = trace
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response
