import os
import json
import re
import time
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.core.config import PROJECTS_STORAGE
from app.domain.models import Project, Scene, SceneImage, ThumbnailOption, ProjectThumbnails
from app.services.whisper_service import whisper_service

def slugify(text: str) -> str:
    text = text.lower().strip()
    # Simple transliteration for Cyrillic
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
        'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
        'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
        'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    }
    for cyr, lat in translit_map.items():
        text = text.replace(cyr, lat)
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "project"

def find_image_variants(
    p_dir: Path,
    shot_id: str,
    image_id: str,
    existing_variants: Optional[List[Any]] = None,
    current_file: Optional[str] = None,
    default_prompt: str = ""
) -> List[Dict[str, Any]]:
    """Accurately finds and returns all image/video variants for a specific cut/image on disk and in project data."""
    clean_shot = re.sub(r"[^\w-]", "", shot_id)
    clean_img_id = re.sub(r"[^\w-]", "", str(image_id))
    valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".mp4", ".webm", ".mov", ".mkv"}
    variants_map: Dict[str, Dict[str, Any]] = {}

    # 1. Load previously known variants that physically exist on disk
    if existing_variants:
        for item in existing_variants:
            f_rel = item.file if hasattr(item, "file") else (item.get("file") if isinstance(item, dict) else None)
            if not f_rel:
                continue
            full_p = p_dir / f_rel
            if full_p.exists() and full_p.is_file() and full_p.stat().st_size > 500:
                f_id = item.id if hasattr(item, "id") else item.get("id", f"v_{full_p.stem}")
                f_prompt = (item.prompt if hasattr(item, "prompt") else item.get("prompt", "")) or default_prompt
                f_created = item.created_at if hasattr(item, "created_at") else item.get("created_at")
                if not f_created:
                    f_created = datetime.fromtimestamp(full_p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                variants_map[f_rel] = {
                    "id": str(f_id),
                    "file": f_rel,
                    "prompt": f_prompt,
                    "created_at": f_created,
                    "_mtime": full_p.stat().st_mtime
                }

    # 2. Add current active file if valid and not yet in map
    if current_file:
        cur_p = p_dir / current_file
        if cur_p.exists() and cur_p.is_file() and cur_p.stat().st_size > 500:
            if current_file not in variants_map:
                mtime_str = datetime.fromtimestamp(cur_p.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                variants_map[current_file] = {
                    "id": f"v_{cur_p.stem}",
                    "file": current_file,
                    "prompt": default_prompt,
                    "created_at": mtime_str,
                    "_mtime": cur_p.stat().st_mtime
                }

    # 3. Disk scanner with precise regex matching for this specific image_id
    shots_dir = p_dir / "shots"
    if shots_dir.exists():
        for f in shots_dir.iterdir():
            if not f.is_file() or f.suffix.lower() not in valid_exts or f.stat().st_size <= 500:
                continue
            fname = f.name
            matched = False

            if clean_img_id in ["img_1", "1"]:
                # img_1 matches:
                # shot_01.png, shot_01_1724398000.png, shot_01_v1724398000.png,
                # shot_01_img_1.png, shot_01_img_1_1724398000.png, shot_01_img1.png, shot_01_img1_1724398000.png
                # MUST NOT match shot_01_img_2..., shot_01_img_3..., shot_01_cut_...
                if re.match(rf"^{re.escape(clean_shot)}\.(?:png|jpg|jpeg|webp|mp4|webm|mov|mkv)$", fname, re.IGNORECASE):
                    matched = True
                elif re.match(rf"^{re.escape(clean_shot)}_(?:v?\d+)\.(?:png|jpg|jpeg|webp|mp4|webm|mov|mkv)$", fname, re.IGNORECASE):
                    matched = True
                elif re.match(rf"^{re.escape(clean_shot)}_img_?1(?:_.*)?\.(?:png|jpg|jpeg|webp|mp4|webm|mov|mkv)$", fname, re.IGNORECASE):
                    matched = True
            else:
                # Other cuts: shot_01_img_2.png, shot_01_img_2_1724398000.png, shot_01_cut_200_1234_1724398000.png
                # Suffix after img_id must be _ or . (not extra digits like img_20)
                if re.match(rf"^{re.escape(clean_shot)}_{re.escape(clean_img_id)}(?:_.*)?\.(?:png|jpg|jpeg|webp|mp4|webm|mov|mkv)$", fname, re.IGNORECASE):
                    matched = True
                elif clean_img_id.startswith("img_") and re.match(rf"^{re.escape(clean_shot)}_img{clean_img_id[4:]}(?:_.*)?\.(?:png|jpg|jpeg|webp|mp4|webm|mov|mkv)$", fname, re.IGNORECASE):
                    matched = True

            if matched:
                rel_f = f"shots/{f.name}"
                if rel_f not in variants_map:
                    mtime_str = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                    variants_map[rel_f] = {
                        "id": f"v_{f.stem}",
                        "file": rel_f,
                        "prompt": default_prompt,
                        "created_at": mtime_str,
                        "_mtime": f.stat().st_mtime
                    }

    # Sort variants by modification time (oldest to newest)
    sorted_variants = sorted(variants_map.values(), key=lambda x: x.get("_mtime", 0.0))
    # Remove internal _mtime helper field before returning
    res = []
    for item in sorted_variants:
        res.append({
            "id": item["id"],
            "file": item["file"],
            "prompt": item.get("prompt", ""),
            "created_at": item.get("created_at", "")
        })
    return res

class ProjectService:
    def __init__(self):
        self.storage_dir = PROJECTS_STORAGE
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def list_projects(self) -> List[Dict[str, Any]]:
        projects = []
        for p in self.storage_dir.iterdir():
            if p.is_dir():
                project_json = p / "project.json"
                if project_json.exists():
                    try:
                        with open(project_json, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            projects.append({
                                "id": data.get("id", p.name),
                                "title": data.get("title", p.name),
                                "scenes_count": len(data.get("scenes", [])),
                                "created_at": data.get("created_at", ""),
                                "updated_at": data.get("updated_at", "")
                            })
                    except Exception:
                        pass
        return sorted(projects, key=lambda x: x.get("updated_at", ""), reverse=True)

    def get_project_dir(self, project_id: str) -> Path:
        import urllib.parse
        decoded = urllib.parse.unquote(project_id).strip()

        # 1. Exact path
        for candidate in [project_id, decoded, slugify(decoded)]:
            if candidate and (self.storage_dir / candidate).exists() and (self.storage_dir / candidate / "project.json").exists():
                return self.storage_dir / candidate

        # 2. Case-insensitive / project.json content match
        for p in self.storage_dir.iterdir():
            if p.is_dir():
                if p.name.lower() in [project_id.lower(), decoded.lower(), slugify(decoded).lower()]:
                    return p
                pj = p / "project.json"
                if pj.exists():
                    try:
                        with open(pj, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            if data.get("id") in [project_id, decoded] or data.get("title", "").lower() in [project_id.lower(), decoded.lower()]:
                                return p
                    except Exception:
                        pass

        # 3. Fallback to direct directory if exists
        p_dir = self.storage_dir / project_id
        if p_dir.exists():
            return p_dir

        raise FileNotFoundError(f"Project '{project_id}' not found")

    def get_project(self, project_id: str) -> Project:
        p_dir = self.get_project_dir(project_id)
        project_json = p_dir / "project.json"
        if not project_json.exists():
            raise FileNotFoundError(f"project.json not found in '{project_id}'")
        
        with open(project_json, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Refresh real file existence status & guarantee distinct image filenames per cut
        scenes_data = data.get("scenes", [])
        for s in scenes_data:
            clean_shot = re.sub(r"[^\w-]", "", s.get("shot_id", "shot_01"))
            primary_file = f"shots/{clean_shot}.png"
            
            aud_rel = s.get("audio_file")
            aud_exists = bool(aud_rel and (p_dir / aud_rel).exists() and (p_dir / aud_rel).stat().st_size > 1000)
            s["audio_status"] = "ready" if aud_exists else "pending"
            
            images = s.get("images", [])
            if not images:
                img_exists = bool((p_dir / primary_file).exists() and (p_dir / primary_file).stat().st_size > 500)
                images = [{
                    "id": "img_1",
                    "image_file": primary_file,
                    "prompt": s.get("image_prompt") or s.get("desc") or "",
                    "start_time": 0.0,
                    "duration": s.get("audio_duration", 0.0),
                    "word_index": 0,
                    "selected_text": "",
                    "status": "ready" if img_exists else "pending"
                }]
                s["images"] = images

            # Fix and enforce unique files and variants for each image
            seen_files = set()
            for idx, img in enumerate(images):
                img_id = img.get("id", f"img_{idx+1}")
                current_f = img.get("image_file")
                if not current_f:
                    if idx == 0 and img.get("start_time", 0.0) == 0.0:
                        current_f = primary_file
                    else:
                        current_f = f"shots/{clean_shot}_{img_id}.png"

                # Find all variants for this image
                raw_variants = img.get("variants", [])
                default_prompt = img.get("prompt") or s.get("image_prompt") or s.get("desc") or ""
                discovered_variants = find_image_variants(
                    p_dir=p_dir,
                    shot_id=clean_shot,
                    image_id=img_id,
                    existing_variants=raw_variants,
                    current_file=current_f,
                    default_prompt=default_prompt
                )
                img["variants"] = discovered_variants

                # Check if current_f is physically valid
                if current_f and (p_dir / current_f).exists() and (p_dir / current_f).stat().st_size > 500:
                    img["status"] = "ready"
                elif discovered_variants:
                    # Fallback to the newest discovered variant
                    current_f = discovered_variants[-1]["file"]
                    img["image_file"] = current_f
                    img["status"] = "ready"
                elif img.get("status") != "generating":
                    img["status"] = "pending"

                img["image_file"] = current_f
                seen_files.add(current_f)

            # Sync scene top-level image properties
            s["images"] = sorted(images, key=lambda x: x.get("start_time", 0.0))
            s["image_file"] = images[0].get("image_file", primary_file) if images else primary_file
            s["image_status"] = "ready" if any(img.get("status") == "ready" for img in s["images"]) else "pending"

        return Project(**data)

    def create_project(self, title: str, aspect_ratio: str = "16:9") -> Project:
        slug = slugify(title)
        p_dir = self.storage_dir / slug
        counter = 1
        while p_dir.exists():
            p_dir = self.storage_dir / f"{slug}-{counter}"
            counter += 1

        p_dir.mkdir(parents=True, exist_ok=True)
        (p_dir / "shots").mkdir(exist_ok=True)
        (p_dir / "audio").mkdir(exist_ok=True)
        (p_dir / "subtitles").mkdir(exist_ok=True)
        (p_dir / "thumbnails").mkdir(exist_ok=True)
        (p_dir / "output").mkdir(exist_ok=True)

        now = datetime.now().isoformat()
        proj = Project(
            id=p_dir.name,
            title=title,
            created_at=now,
            updated_at=now,
            scenes=[],
            settings={
                "speed": 1.2,
                "voice_id": "",
                "voice_name": "Chatterbox Local",
                "model_id": "chatterbox_turbo",
                "resolution": "1080p",
                "aspect_ratio": aspect_ratio or "16:9",
                "style_preset": "Sam O'Nella Stickman Minimalist"
            }
        )

        with open(p_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(proj.model_dump(), f, indent=2, ensure_ascii=False)

        return proj

    def save_project(self, project: Project) -> Project:
        p_dir = self.get_project_dir(project.id)
        (p_dir / "thumbnails").mkdir(exist_ok=True)
        project.updated_at = datetime.now().isoformat()

        # Load existing variants from disk to avoid wiping them if incoming project payload has empty variants
        existing_variants_map = {}
        project_json = p_dir / "project.json"
        if project_json.exists():
            try:
                with open(project_json, "r", encoding="utf-8") as f:
                    old_data = json.load(f)
                for old_scene in old_data.get("scenes", []):
                    old_s_id = old_scene.get("id")
                    for old_img in old_scene.get("images", []):
                        old_img_id = old_img.get("id")
                        old_v = old_img.get("variants", [])
                        if old_v:
                            existing_variants_map[(old_s_id, old_img_id)] = old_v
            except Exception:
                pass

        from app.domain.models import ImageVariant
        for s in project.scenes:
            clean_shot = re.sub(r"[^\w-]", "", s.shot_id)
            for idx, img in enumerate(s.images):
                img_id = img.id or f"img_{idx+1}"
                old_v = existing_variants_map.get((s.id, img_id), [])
                raw_v = img.variants if img.variants else old_v
                merged_v = find_image_variants(
                    p_dir=p_dir,
                    shot_id=clean_shot,
                    image_id=img_id,
                    existing_variants=raw_v,
                    current_file=img.image_file,
                    default_prompt=img.prompt or s.image_prompt or ""
                )
                img.variants = [ImageVariant(**v) for v in merged_v]

                if img.image_file and (p_dir / img.image_file).exists() and (p_dir / img.image_file).stat().st_size > 500:
                    img.status = "ready"
                elif img.variants:
                    img.image_file = img.variants[-1].file
                    img.status = "ready"
                elif img.status != "generating":
                    img.status = "pending"

            if s.images:
                s.image_file = s.images[0].image_file
                s.image_status = "ready" if any(im.status == "ready" for im in s.images) else "pending"

        with open(p_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
        return project

    def delete_project(self, project_id: str):
        p_dir = self.get_project_dir(project_id)
        shutil.rmtree(p_dir)

    def import_existing_folder(self, src_dir: Path, title: str, project_slug: str):
        dst_dir = self.storage_dir / project_slug
        dst_dir.mkdir(parents=True, exist_ok=True)
        (dst_dir / "shots").mkdir(exist_ok=True)
        (dst_dir / "audio").mkdir(exist_ok=True)
        (dst_dir / "subtitles").mkdir(exist_ok=True)
        (dst_dir / "thumbnails").mkdir(exist_ok=True)
        (dst_dir / "output").mkdir(exist_ok=True)

        src_shots = src_dir / "shots" if (src_dir / "shots").exists() else src_dir / "images"
        if src_shots.exists():
            for f in src_shots.iterdir():
                if f.is_file() and f.suffix.lower() in [".png", ".jpg", ".jpeg"]:
                    shutil.copy2(f, dst_dir / "shots" / f.name)

        src_audio = src_dir / "audio_clips" if (src_dir / "audio_clips").exists() else src_dir / "audio"
        if src_audio.exists():
            for f in src_audio.iterdir():
                if f.is_file() and f.suffix.lower() in [".mp3", ".wav"]:
                    shutil.copy2(f, dst_dir / "audio" / f.name)

        timeline_f = src_dir / "timeline_alignment.json"
        if not timeline_f.exists():
            timeline_f = src_dir / "storyboard_timeline.json"

        scenes = []
        if timeline_f.exists():
            with open(timeline_f, "r", encoding="utf-8") as tf:
                timeline_data = json.load(tf)
            for idx, item in enumerate(timeline_data, 1):
                shot_name = item.get("shot_png") or item.get("shot") or f"shot_{idx:02d}.png"
                img_exists = (dst_dir / "shots" / shot_name).exists()
                audio_name = f"voice_{idx:02d}.mp3"
                aud_exists = (dst_dir / "audio" / audio_name).exists()
                aud_dur = float(item.get("duration", item.get("voice_duration", 3.0)))
                prompt_txt = item.get("image_prompt") or item.get("prompt") or item.get("desc") or ""

                scenes.append(Scene(
                    id=idx,
                    shot_id=f"shot_{idx:02d}",
                    timing=f"{item.get('start_time', 0):.1f}s - {item.get('end_time', 0):.1f}s",
                    text=item.get("text") or item.get("voiceover_en") or "",
                    desc=item.get("desc") or item.get("scene_description") or "",
                    image_prompt=prompt_txt,
                    image_file=f"shots/{shot_name}",
                    audio_file=f"audio/{audio_name}" if aud_exists else None,
                    audio_duration=aud_dur,
                    image_status="ready" if img_exists else "pending",
                    audio_status="ready" if aud_exists else "pending",
                    images=[
                        SceneImage(
                            id="img_1",
                            image_file=f"shots/{shot_name}",
                            prompt=prompt_txt,
                            start_time=0.0,
                            duration=aud_dur,
                            status="ready" if img_exists else "pending"
                        )
                    ]
                ))

        now = datetime.now().isoformat()
        proj = Project(
            id=project_slug,
            title=title,
            created_at=now,
            updated_at=now,
            scenes=scenes
        )

        with open(dst_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(proj.model_dump(), f, indent=2, ensure_ascii=False)

    def get_scene_words(self, project_id: str, scene_id: int) -> List[Dict[str, Any]]:
        proj = self.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена {scene_id} не найдена")

        if scene.words:
            return scene.words

        if not scene.audio_file:
            return []

        proj_dir = self.get_project_dir(project_id)
        aud_path = proj_dir / scene.audio_file
        if not aud_path.exists():
            return []

        words = whisper_service.transcribe_single_audio_words(aud_path)
        scene.words = words
        self.save_project(proj)
        return words

    def add_scene_image(self, project_id: str, scene_id: int, word_index: int, selected_text: str, start_time: float, prompt: str) -> SceneImage:
        proj = self.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена {scene_id} не найдена")

        clean_shot = re.sub(r"[^\w-]", "", scene.shot_id)
        unique_suffix = f"cut_{int(start_time * 100)}_{int(time.time() % 10000)}"
        img_rel = f"shots/{clean_shot}_{unique_suffix}.png"

        new_img = SceneImage(
            id=unique_suffix,
            image_file=img_rel,
            prompt=prompt,
            start_time=round(start_time, 2),
            duration=None,
            word_index=word_index,
            selected_text=selected_text,
            status="pending"
        )
        scene.images.append(new_img)
        scene.images = sorted(scene.images, key=lambda x: x.start_time)
        self.save_project(proj)
        return new_img

    def delete_scene_image(self, project_id: str, scene_id: int, image_id: str):
        proj = self.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена {scene_id} не найдена")

        if len(scene.images) <= 1:
            raise ValueError("Нельзя удалить единственный кадр сцены")

        scene.images = [img for img in scene.images if img.id != image_id]
        self.save_project(proj)

    def update_image_style(self, project_id: str, scene_id: int, image_id: str, style: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        proj = self.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена {scene_id} не найдена")

        target_img = next((img for img in scene.images if img.id == image_id), None)
        if not target_img:
            if scene.images:
                target_img = scene.images[0]
            else:
                raise ValueError(f"Кадр {image_id} не найден")

        target_img.style = style
        if prompt is not None:
            target_img.prompt = prompt

        if target_img.id == scene.images[0].id:
            scene.style = style
            if prompt is not None:
                scene.image_prompt = prompt

        self.save_project(proj)
        return {"success": True, "scene_id": scene_id, "image_id": target_img.id, "style": style, "prompt": target_img.prompt}

    def update_project_settings(self, project_id: str, settings: Dict[str, Any]) -> Project:
        proj = self.get_project(project_id)
        if not proj.settings:
            proj.settings = {}
        proj.settings.update(settings)
        return self.save_project(proj)

project_service = ProjectService()

