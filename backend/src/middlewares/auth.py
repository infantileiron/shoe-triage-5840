from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from src.config.settings import connect
from src.constants.domain import Role

bearer = OAuth2PasswordBearer(tokenUrl='auth/login')


def identity(token: Annotated[str, Depends(bearer)]):
    from src.utils.security import subject

    try:
        user = subject(token)
    except jwt.InvalidTokenError as exc:
        raise HTTPException(401, '会话已失效，请重新登录') from exc
    with connect() as db:
        actor = db.execute('SELECT username, name, role FROM accounts WHERE username=%s', (user,)).fetchone()
    if actor is None:
        raise HTTPException(401, '账号不可用')
    return actor


def permit(role):
    def allowed(actor=Depends(identity)):
        if actor['role'] != role:
            raise HTTPException(403, '当前席位无权执行此操作')
        return actor
    return allowed


analyst = permit(Role.analyst)
owner = permit(Role.owner)
