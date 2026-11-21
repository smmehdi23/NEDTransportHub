import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401  (register all models on Base.metadata)
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.routers import (
    admin, admin_ops, auth, bookings, chat, drivers, history, maps, notifications, payments, polls, ratings, rides,
    safety, tracking, users,
)
from app.services.reminders import reminder_loop
from app.services.bootstrap import bootstrap_admin


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        bootstrap_admin(db)
    task = asyncio.create_task(reminder_loop()) if settings.reminders_enabled else None
    yield
    if task:
        task.cancel()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

if settings.cors_origin_list:
    allow_all = "*" in settings.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"] if allow_all else settings.cors_origin_list,
        allow_credentials=not allow_all,
        allow_methods=["*"],
        allow_headers=["*"],
    )

api = APIRouter(prefix=settings.api_prefix)
for module in (
    auth, users, drivers, admin,                                   # Member 1
    maps, rides, polls, bookings, payments, notifications, chat,   # Member 2
    tracking, ratings, safety, history, admin_ops,
):
    api.include_router(module.router)
app.include_router(api)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": settings.app_name}
