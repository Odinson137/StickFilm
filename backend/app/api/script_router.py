from fastapi import APIRouter, Query
from typing import Dict, Any, List, Optional
from app.core.config import get_master_claude_prompt
from app.domain.models import ScriptParseRequest, Scene, ScriptParseResponse
from app.services.script_parser import script_parser

router = APIRouter(prefix="/api/script", tags=["script"])

@router.get("/master-prompt")
def get_master_prompt(aspect_ratio: Optional[str] = Query("16:9")) -> Dict[str, str]:
    return {"prompt": get_master_claude_prompt(aspect_ratio or "16:9")}

@router.post("/parse", response_model=ScriptParseResponse)
def parse_script(req: ScriptParseRequest):
    scenes, settings, thumbnails = script_parser.parse_script(req.script_text)
    return ScriptParseResponse(scenes=scenes, settings=settings, thumbnails=thumbnails)
