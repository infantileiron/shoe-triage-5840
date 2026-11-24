from fastapi import APIRouter, Depends, HTTPException, Request

from src.config.settings import cache, connect
from src.middlewares.auth import identity
from src.schemas.inputs import Credentials
from src.utils.security import issue, matches

router = APIRouter(prefix='/auth')
DUMMY_HASH = f'{"0" * 32}${"0" * 64}'


@router.post('/login')
def login(payload: Credentials, request: Request):
    # Atomic fixed window, keyed by the direct client and account.
    key = f'login:{request.client.host}:{payload.username.lower()}'
    hits = cache.eval('''local n = redis.call('INCR', KEYS[1]);
                         if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end;
                         return n''', 1, key)
    if hits > 15:
        raise HTTPException(429, '登录尝试过多，请等待一分钟')
    with connect() as db:
        actor = db.execute('SELECT * FROM accounts WHERE username=%s', (payload.username,)).fetchone()
    valid = matches(payload.password, actor['password_hash'] if actor else DUMMY_HASH)
    if not valid or actor is None:
        raise HTTPException(401, '工号或密码有误')
    return {'token': issue(actor['username']), 'user': {k: actor[k] for k in ('username', 'name', 'role')}}


@router.get('/me')
def me(actor=Depends(identity)):
    return actor
