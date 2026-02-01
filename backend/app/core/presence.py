import time
from typing import Iterable, Set

import redis

from .config import settings


_r = redis.from_url(settings.redis_url, decode_responses=True)
_TTL_SECONDS = 120


def mark_online(user_id: int) -> None:
    key = f"presence:user:{user_id}"
    _r.set(key, str(int(time.time())), ex=_TTL_SECONDS)


def get_online_user_ids(user_ids: Iterable[int]) -> Set[int]:
    user_ids_list = list(user_ids)
    keys = [f"presence:user:{uid}" for uid in user_ids_list]
    if not keys:
        return set()
    res = _r.mget(keys)
    online: Set[int] = set()
    for idx, val in enumerate(res or []):
        if val is not None:
            # key exists and not expired
            online.add(user_ids_list[idx])
    return online


