import os
import platform
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from typing import Dict, Any, Optional
from app.domain.models import RenderVideoRequest, RenderShortsRequest
from app.services.video_service import video_service
from app.services.project_service import project_service
from app.services.metadata_service import metadata_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/video", tags=["video"])

@router.post("/render-full/{project_id}")
def render_full_video(project_id: str, req: RenderVideoRequest):
    try:
        res = video_service.render_full_video(
            project_id,
            speed=req.speed or 1.2,
            motion_effect=req.motion_effect or "zoom_in",
            aspect_ratio=req.aspect_ratio,
            bgm_track=req.bgm_track,
            bgm_volume=req.bgm_volume
        )
        # auto generate metadata
        metadata_service.generate_project_metadata(project_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BumperImageReq(BaseModel):
    prompt: str
    output_name: str
    is_vertical: bool = True

class BumperAudioReq(BaseModel):
    text: str
    output_name: str

@router.get("/shorts-plan/{project_id}")
def get_shorts_plan(project_id: str, speed: float = 1.2, force: bool = False):
    try:
        return video_service.get_shorts_plan(project_id, speed, force_recalc=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SavePlanRequest(BaseModel):
    chunks: list
    speed: float = 1.0

@router.post("/shorts-plan/{project_id}")
def save_shorts_plan(project_id: str, req: SavePlanRequest):
    try:
        video_service.save_shorts_plan(project_id, req.chunks, req.speed)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-bumper-image/{project_id}")
def generate_bumper_image(project_id: str, req: BumperImageReq):
    try:
        return video_service.generate_bumper_image(project_id, req.prompt, req.output_name, req.is_vertical)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-bumper-audio/{project_id}")
def generate_bumper_audio(project_id: str, req: BumperAudioReq):
    try:
        return video_service.generate_bumper_audio(project_id, req.text, req.output_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/render-shorts-tiktoks/{project_id}")
def render_shorts_and_tiktoks(project_id: str, req: RenderVideoRequest):
    try:
        res = video_service.render_shorts_and_tiktoks(
            project_id,
            speed=req.speed or 1.2,
            motion_effect=req.motion_effect or "zoom_in",
            aspect_ratio=req.aspect_ratio
        )
        # auto generate metadata
        metadata_service.generate_project_metadata(project_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{project_id}")
def download_video_file(project_id: str, rel_path: str = Query(...)):
    try:
        proj_dir = project_service.get_project_dir(project_id)
        file_path = proj_dir / rel_path
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Файл видео не найден")
        
        filename = file_path.name
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/open-folder/{project_id}")
def open_project_folder(project_id: str, subfolder: Optional[str] = Query("output")):
    try:
        proj_dir = project_service.get_project_dir(project_id)
        target_dir = proj_dir / subfolder if subfolder else proj_dir
        target_dir.mkdir(parents=True, exist_ok=True)

        if platform.system() == "Windows":
            os.startfile(str(target_dir))
        elif platform.system() == "Darwin":
            subprocess.run(["open", str(target_dir)])
        else:
            subprocess.run(["xdg-open", str(target_dir)])

        return {
            "success": True,
            "path": str(target_dir)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metadata/{project_id}")
def get_metadata(project_id: str):
    try:
        return metadata_service.get_metadata(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/metadata/{project_id}/generate")
def generate_metadata(project_id: str):
    try:
        return metadata_service.generate_project_metadata(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
