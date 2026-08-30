from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.domain.models import Project, ProjectCreateRequest
from app.services.project_service import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])

@router.get("", response_model=List[Dict[str, Any]])
def list_projects():
    return project_service.list_projects()

@router.post("", response_model=Project)
def create_project(req: ProjectCreateRequest):
    return project_service.create_project(req.title, req.aspect_ratio or "16:9")

@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str):
    try:
        return project_service.get_project(project_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{project_id}", response_model=Project)
def save_project(project_id: str, project: Project):
    try:
        return project_service.save_project(project)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{project_id}/settings", response_model=Project)
def update_project_settings(project_id: str, settings: Dict[str, Any]):
    try:
        return project_service.update_project_settings(project_id, settings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{project_id}")
def delete_project(project_id: str):
    try:
        project_service.delete_project(project_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

