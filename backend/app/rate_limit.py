import time
from collections import defaultdict, deque
from dataclasses import dataclass


@dataclass(frozen=True)
class RateLimitRule:
    window_seconds: int
    max_requests: int


class SlidingWindowRateLimiter:
    def __init__(self) -> None:
        self._store: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, rule: RateLimitRule, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        bucket = self._store[key]
        cutoff = current - rule.window_seconds

        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= rule.max_requests:
            return False

        bucket.append(current)
        return True


GLOBAL_LIMITER = SlidingWindowRateLimiter()
