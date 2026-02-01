from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .api.routes.health import router as health_router
from .api.routes.auth import router as auth_router
from .api.routes.users import router as users_router
from .api.routes.documents import router as documents_router
from .api.routes.search import router as search_router
from .api.routes.permissions import router as permissions_router
from .api.routes.activity import router as activity_router
from .api.routes.reports import router as reports_router
from .api.routes.students import router as students_router
from .core.db import SessionLocal
from .core.startup import seed_roles_and_admin


def create_app() -> FastAPI:
    app = FastAPI(title="نظام أرشفة وتحليل البيانات API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # في التطوير، السماح لجميع المنافذ
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix="/health", tags=["health"]) 
    app.include_router(auth_router, prefix="/auth", tags=["auth"]) 
    app.include_router(users_router, prefix="/users", tags=["users"]) 
    app.include_router(documents_router, prefix="/documents", tags=["documents"]) 
    app.include_router(search_router, prefix="/search", tags=["search"]) 
    app.include_router(permissions_router, prefix="/permissions", tags=["permissions"]) 
    app.include_router(activity_router, prefix="/activity", tags=["activity"]) 
    app.include_router(reports_router, prefix="/reports", tags=["reports"]) 
    app.include_router(students_router, prefix="/api", tags=["students"]) 

    @app.get("/")
    def root():
        return {"status": "ok", "service": "نظام أرشفة وتحليل البيانات لمركز الاستشارات والتنمية", "version": "0.1.0"}

    @app.on_event("startup")
    def on_startup():
        db = SessionLocal()
        try:
            seed_roles_and_admin(db)
        finally:
            db.close()

    return app


app = create_app()




