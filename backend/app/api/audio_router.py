from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List
from app.core.tokens import token_manager
from app.domain.models import GenerateAudioSingleRequest, TokenAddRequest
from app.services.tts_service import tts_service

router = APIRouter(prefix="/api/audio", tags=["audio"])

@router.get("/tokens", response_model=List[Dict[str, Any]])
def get_tokens():
    return token_manager.get_tokens()

@router.post("/tokens")
def add_token(req: TokenAddRequest):
    try:
        return token_manager.add_token(req.key)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/tokens/{key}")
def delete_token(key: str):
    token_manager.remove_token(key)
    return {"success": True}

@router.post("/tokens/{key}/check")
def check_token(key: str):
    return token_manager.check_token_quota(key)

@router.post("/generate-single/{project_id}")
def generate_single_audio(project_id: str, req: GenerateAudioSingleRequest):
    try:
        return tts_service.generate_single_scene_audio(project_id, req.scene_id, req.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-all/{project_id}")
def generate_all_audio(project_id: str):
    try:
        return tts_service.generate_all_scenes_audio(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
