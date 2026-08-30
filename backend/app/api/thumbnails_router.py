from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, Optional
from app.domain.models import ProjectThumbnails, ThumbnailOption
from app.services.thumbnail_service import thumbnail_service

router = APIRouter(prefix="/api/thumbnails", tags=["thumbnails"])

@router.get("/{project_id}", response_model=ProjectThumbnails)
def get_thumbnails(project_id: str):
    try:
        return thumbnail_service.get_thumbnails(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/generate/{thumb_id}", response_model=ThumbnailOption)
def generate_thumbnail(project_id: str, thumb_id: str, prompt: Optional[str] = Body(None, embed=True)):
    try:
        return thumbnail_service.generate_thumbnail(project_id, thumb_id, custom_prompt=prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/refresh-prompts", response_model=ProjectThumbnails)
def refresh_prompts(project_id: str):
    try:
        return thumbnail_service.refresh_prompts(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/save-options", response_model=ProjectThumbnails)
def save_thumbnail_options(project_id: str, payload: Dict[str, Any] = Body(...)):
    try:
        options = payload.get("thumbnails", [])
        return thumbnail_service.save_thumbnail_options(project_id, options)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/generate-all")
def generate_all_thumbnails(project_id: str):
    try:
        thumbs = thumbnail_service.get_thumbnails(project_id)
        results = []
        for t in thumbs.thumbnails:
            res = thumbnail_service.generate_thumbnail(project_id, t.id)
            results.append(res)
        return {"success": True, "thumbnails": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
