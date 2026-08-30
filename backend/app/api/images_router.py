import shutil
from pathlib import Path
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from typing import Dict, Any, Optional
from app.domain.models import GenerateImageSingleRequest, AddSceneImageRequest, DeleteSceneImageRequest, SelectVariantRequest
from app.services.gemini_bot import gemini_bot
from app.services.project_service import project_service

router = APIRouter(prefix="/api/images", tags=["images"])

@router.get("/{project_id}/scene/{scene_id}/words")
def get_scene_words(project_id: str, scene_id: int):
    try:
        words = project_service.get_scene_words(project_id, scene_id)
        return {"words": words}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/scene/{scene_id}/add-image")
def add_scene_image(project_id: str, scene_id: int, req: AddSceneImageRequest):
    try:
        new_img = project_service.add_scene_image(
            project_id=project_id,
            scene_id=scene_id,
            word_index=req.word_index,
            selected_text=req.selected_text,
            start_time=req.start_time,
            prompt=req.prompt
        )
        return new_img
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateImageStyleRequest(BaseModel):
    style: str
    prompt: Optional[str] = None

@router.put("/{project_id}/scene/{scene_id}/image/{image_id}/style")
def update_image_style(project_id: str, scene_id: int, image_id: str, req: UpdateImageStyleRequest):
    try:
        return project_service.update_image_style(project_id, scene_id, image_id, req.style, req.prompt)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{project_id}/scene/{scene_id}/delete-image/{image_id}")
def delete_scene_image(project_id: str, scene_id: int, image_id: str):
    try:
        project_service.delete_scene_image(project_id, scene_id, image_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/scene/{scene_id}/upload-video")
async def upload_video_clip(
    project_id: str,
    scene_id: int,
    file: UploadFile = File(...),
    image_id: Optional[str] = Form(None)
):
    try:
        import time
        from datetime import datetime
        from app.domain.models import ImageVariant

        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise HTTPException(status_code=404, detail="Сцена не найдена")

        target_img = None
        if image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == image_id), None)
        elif scene.images:
            target_img = scene.images[0]

        ts = int(time.time())
        ext = Path(file.filename or "clip.mp4").suffix or ".mp4"
        img_label = target_img.id if target_img else (image_id or "img_1")
        rel_file = f"shots/{scene.shot_id}_{img_label}_{ts}{ext}"

        dest_path = proj_dir / rel_file
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if target_img:
            # Preserve existing file in variants before overwriting active pointer
            if target_img.image_file and (proj_dir / target_img.image_file).exists():
                if not any(v.file == target_img.image_file for v in target_img.variants):
                    target_img.variants.append(ImageVariant(
                        id="v_0",
                        file=target_img.image_file,
                        prompt=target_img.prompt,
                        created_at=now_iso
                    ))

            target_img.variants.append(ImageVariant(
                id=f"v_{ts}",
                file=rel_file,
                prompt="Загруженное MP4 видео",
                created_at=now_iso
            ))
            target_img.image_file = rel_file
            target_img.status = "ready"
            if scene.images and target_img.id == scene.images[0].id:
                scene.image_file = rel_file
                scene.image_status = "ready"
        else:
            scene.image_file = rel_file
            scene.image_status = "ready"

        project_service.save_project(proj)
        return {
            "success": True,
            "scene_id": scene_id,
            "image_id": image_id,
            "file": rel_file
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}/scene/{scene_id}/variants/{image_id}")
def get_image_variants(project_id: str, scene_id: int, image_id: str):
    try:
        from app.domain.models import ImageVariant
        from app.services.project_service import find_image_variants

        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise HTTPException(status_code=404, detail="Сцена не найдена")

        target_img = None
        if image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == image_id), None)
        elif scene.images:
            target_img = scene.images[0]

        default_prompt = (target_img.prompt if target_img else scene.image_prompt) or scene.desc or scene.text
        current_file = target_img.image_file if target_img else scene.image_file

        discovered = find_image_variants(
            p_dir=proj_dir,
            shot_id=scene.shot_id,
            image_id=(target_img.id if target_img else image_id),
            existing_variants=(target_img.variants if target_img else []),
            current_file=current_file,
            default_prompt=default_prompt
        )

        variant_models = [ImageVariant(**v) for v in discovered]
        if target_img:
            target_img.variants = variant_models
            if current_file and (proj_dir / current_file).exists() and (proj_dir / current_file).stat().st_size > 500:
                target_img.status = "ready"
            elif variant_models:
                target_img.image_file = variant_models[-1].file
                current_file = target_img.image_file
                target_img.status = "ready"
            project_service.save_project(proj)

        return {
            "scene_id": scene_id,
            "image_id": image_id,
            "active_file": current_file,
            "variants": [v.model_dump() for v in variant_models]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/scene/{scene_id}/select-variant")
def select_image_variant(project_id: str, scene_id: int, req: SelectVariantRequest):
    try:
        from datetime import datetime
        from app.domain.models import ImageVariant

        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise HTTPException(status_code=404, detail="Сцена не найдена")

        target_img = None
        if req.image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == req.image_id), None)
        elif scene.images:
            target_img = scene.images[0]

        target_file_path = proj_dir / req.file
        if not target_file_path.exists():
            raise HTTPException(status_code=404, detail=f"Файл {req.file} не найден на диске")

        if target_img:
            # Ensure the selected variant is in variants list
            if not any(v.file == req.file for v in target_img.variants):
                target_img.variants.append(ImageVariant(
                    id=f"v_{target_file_path.stem}",
                    file=req.file,
                    prompt=target_img.prompt,
                    created_at=datetime.fromtimestamp(target_file_path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                ))

            # Sync prompt if variant has one
            matched_var = next((v for v in target_img.variants if v.file == req.file), None)
            if matched_var and matched_var.prompt:
                target_img.prompt = matched_var.prompt

            target_img.image_file = req.file
            target_img.status = "ready"
            if scene.images and target_img.id == scene.images[0].id:
                scene.image_file = req.file
                scene.image_status = "ready"
        else:
            scene.image_file = req.file
            scene.image_status = "ready"

        project_service.save_project(proj)
        return {"success": True, "active_file": req.file}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{project_id}/scene/{scene_id}/delete-variant")
def delete_image_variant(project_id: str, scene_id: int, req: SelectVariantRequest):
    try:
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise HTTPException(status_code=404, detail="Сцена не найдена")

        target_img = None
        if req.image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == req.image_id), None)
        elif scene.images:
            target_img = scene.images[0]

        if target_img and target_img.variants:
            target_img.variants = [v for v in target_img.variants if v.file != req.file]
            if target_img.image_file == req.file:
                if target_img.variants:
                    target_img.image_file = target_img.variants[-1].file
                    target_img.status = "ready"
                else:
                    target_img.image_file = None
                    target_img.status = "pending"

            if scene.images and target_img.id == scene.images[0].id:
                scene.image_file = target_img.image_file
                scene.image_status = target_img.status

        target_file = proj_dir / req.file
        if target_file.exists():
            try:
                target_file.unlink()
            except Exception:
                pass

        project_service.save_project(proj)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-single/{project_id}")
def generate_single_image(project_id: str, req: GenerateImageSingleRequest):
    try:
        proj = project_service.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == req.scene_id), None)
        if not scene:
            raise HTTPException(status_code=404, detail="Сцена не найдена")

        # Find target SceneImage
        target_img = None
        if req.image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == req.image_id), None)
        elif scene.images:
            target_img = scene.images[0]

        img_id_to_use = target_img.id if target_img else req.image_id
        prompt_to_use = req.prompt or (target_img.prompt if target_img else scene.image_prompt) or scene.desc or scene.text

        return gemini_bot.generate_single_image(
            project_id=project_id,
            scene_id=req.scene_id,
            custom_prompt=prompt_to_use,
            image_id=img_id_to_use,
            aspect_ratio=req.aspect_ratio
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/batch-status/{project_id}")
def get_batch_images_status(project_id: str):
    try:
        return gemini_bot.get_batch_status(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop-batch/{project_id}")
def stop_batch_images(project_id: str):
    try:
        gemini_bot.stop_batch(project_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-all/{project_id}")
def generate_all_images(project_id: str):
    try:
        return gemini_bot.generate_all_images(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
