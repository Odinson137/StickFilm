import os
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import PROJECTS_STORAGE
from app.api.projects_router import router as projects_router
from app.api.script_router import router as script_router
from app.api.audio_router import router as audio_router
from app.api.images_router import router as images_router
from app.api.video_router import router as video_router
from app.api.thumbnails_router import router as thumbnails_router
from app.api.bgm_router import router as bgm_router

app = FastAPI(
    title="Stickfilm Studio API",
    description="Backend API for automated stickman movie recap video creation",
    version="1.1.0"
)

# CORS middleware for local React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static storage for serving images, audio, thumbnails and videos to frontend
app.mount("/media/projects", StaticFiles(directory=str(PROJECTS_STORAGE)), name="projects_media")

# Include API Routers
app.include_router(projects_router)
app.include_router(script_router)
app.include_router(audio_router)
app.include_router(images_router)
app.include_router(video_router)
app.include_router(thumbnails_router)
app.include_router(bgm_router)

@app.get("/")
def root():
    return {
        "app": "Stickfilm Studio API",
        "status": "online",
        "version": "1.1.0"
    }
