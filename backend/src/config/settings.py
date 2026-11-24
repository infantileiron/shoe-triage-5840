import os

import psycopg
import redis
from psycopg.rows import dict_row


def connect():
    return psycopg.connect(os.environ['DATABASE_URL'], row_factory=dict_row, connect_timeout=3)


cache = redis.Redis.from_url(os.environ['REDIS_URL'], socket_timeout=3)
SIGNING_KEY = os.environ['JWT_SECRET']
