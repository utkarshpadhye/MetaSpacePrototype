import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.rate_limit import GLOBAL_LIMITER, RateLimitRule
from app.routes.auth import router as auth_router
from app.routes.crm import router as crm_router
from app.routes.docs import router as docs_router
from app.routes.members import router as members_router
from app.routes.milestones import router as milestones_router
from app.routes.overrides import router as overrides_router
from app.routes.projects import router as projects_router
from app.routes.roles import router as roles_router
from app.routes.sprints import router as sprints_router
from app.routes.tasks import router as tasks_router
from app.routes.workspaces import router as workspaces_router


settings = get_settings()
logger = logging.getLogger('metaspace.api')
logging.basicConfig(level=logging.INFO)

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


GLOBAL_RULE = RateLimitRule(window_seconds=60, max_requests=settings.rate_limit_per_minute)
MUTATION_RULE = RateLimitRule(window_seconds=60, max_requests=settings.rate_limit_burst)


@app.middleware('http')
async def rate_limit_middleware(request: Request, call_next):
    # Keep key compact and avoid header parsing beyond what is needed for fair limits.
    user_key = request.headers.get('X-User-Id') or request.client.host if request.client else 'anonymous'
    global_key = f'global:{user_key}'
    if not GLOBAL_LIMITER.allow(global_key, GLOBAL_RULE):
        return JSONResponse(status_code=429, content={'detail': 'Rate limit exceeded'})

    if request.method in {'POST', 'PATCH', 'PUT', 'DELETE'}:
        mutation_key = f'mutation:{user_key}:{request.url.path}'
        if not GLOBAL_LIMITER.allow(mutation_key, MUTATION_RULE):
            return JSONResponse(status_code=429, content={'detail': 'Mutation rate limit exceeded'})

    return await call_next(request)


@app.middleware('http')
async def request_logging_middleware(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        '%s %s -> %s (%.2f ms)',
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception('Unhandled server error: %s', str(exc))
    return JSONResponse(
        status_code=500,
        content={'detail': 'Internal server error'},
    )


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok', 'app': settings.app_name}


app.include_router(projects_router)
app.include_router(workspaces_router)
app.include_router(members_router)
app.include_router(roles_router)
app.include_router(overrides_router)
app.include_router(sprints_router)
app.include_router(milestones_router)
app.include_router(tasks_router)
app.include_router(docs_router)
app.include_router(crm_router)
app.include_router(auth_router)
