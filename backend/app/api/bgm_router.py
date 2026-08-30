from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.bgm_service import bgm_service

router = APIRouter(prefix="/api/bgm", tags=["bgm"])

class YouTubeDownloadRequest(BaseModel):
    url: str
    title: Optional[str] = None

@router.get("/tracks")
def get_tracks() -> List[Dict[str, Any]]:
    return bgm_service.list_tracks()

@router.post("/download-youtube")
def download_youtube_track(req: YouTubeDownloadRequest) -> Dict[str, Any]:
    try:
        return bgm_service.download_from_youtube(req.url, req.title)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload")
async def upload_bgm_track(file: UploadFile = File(...)) -> Dict[str, Any]:
    try:
        content = await file.read()
        return bgm_service.save_uploaded_track(content, file.filename or "uploaded_track.mp3")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/stream/{filename}")
def stream_bgm_track(filename: str):
    file_path = bgm_service.get_track_file(filename)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Track not found")
    return FileResponse(file_path, media_type="audio/mpeg", filename=filename)
