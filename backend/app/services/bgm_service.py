import os
import re
import json
import subprocess
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional

class BGMService:
    def __init__(self):
        # Base BGM directory in backend/assets/bgm
        self.base_dir = Path(__file__).resolve().parent.parent.parent
        self.bgm_dir = self.base_dir / "assets" / "bgm"
        self.bgm_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_file = self.bgm_dir / "metadata.json"
        self._ensure_default_metadata()

    def _ensure_default_metadata(self):
        if not self.metadata_file.exists():
            default_meta = {
                "tracks": []
            }
            with open(self.metadata_file, "w", encoding="utf-8") as f:
                json.dump(default_meta, f, indent=2, ensure_ascii=False)

    def _get_metadata(self) -> Dict[str, Any]:
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return {"tracks": data}
                    if isinstance(data, dict):
                        if "tracks" not in data:
                            data["tracks"] = []
                        return data
            except Exception:
                pass
        return {"tracks": []}

    def _save_metadata(self, data: Dict[str, Any]):
        with open(self.metadata_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get_track_duration(self, file_path: Path) -> float:
        try:
            cmd = [
                "ffprobe", "-v", "error", "-show_entries",
                "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
                str(file_path)
            ]
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
            return round(float(result.stdout.strip()), 2)
        except Exception:
            return 0.0

    def list_tracks(self) -> List[Dict[str, Any]]:
        meta = self._get_metadata()
        known_tracks = {t["filename"]: t for t in meta.get("tracks", [])}
        
        tracks = []
        for file in self.bgm_dir.glob("*.mp3"):
            fn = file.name
            if fn in known_tracks:
                track_info = known_tracks[fn]
                if not track_info.get("duration"):
                    track_info["duration"] = self.get_track_duration(file)
                tracks.append(track_info)
            else:
                dur = self.get_track_duration(file)
                title = fn.replace(".mp3", "").replace("_", " ").title()
                track_info = {
                    "id": fn,
                    "filename": fn,
                    "title": title,
                    "category": "custom",
                    "duration": dur
                }
                tracks.append(track_info)
                known_tracks[fn] = track_info

        # Update metadata with discovered tracks
        meta["tracks"] = list(known_tracks.values())
        self._save_metadata(meta)
        return sorted(tracks, key=lambda x: (x.get("category", ""), x.get("title", "")))

    def download_from_youtube(self, url: str, custom_title: Optional[str] = None) -> Dict[str, Any]:
        """Скачивает аудиодорожку с YouTube в формате MP3 через yt-dlp и ffmpeg"""
        url = url.strip()
        if not url:
            raise ValueError("URL cannot be empty")

        import uuid
        temp_id = str(uuid.uuid4())[:8]
        out_template = str(self.bgm_dir / f"yt_{temp_id}.%(ext)s")

        cmd = [
            "yt-dlp",
            "--no-playlist",
            "-x",
            "--audio-format", "mp3",
            "--audio-quality", "192K",
            "--print-json",
            "-o", out_template,
            url
        ]

        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if proc.returncode != 0:
            err_msg = proc.stderr or proc.stdout or "yt-dlp execution failed"
            raise RuntimeError(f"Не удалось скачать аудио с YouTube: {err_msg[:200]}")

        title = custom_title
        duration = 0.0
        try:
            for line in proc.stdout.splitlines():
                if line.strip().startswith("{"):
                    info = json.loads(line.strip())
                    if not title:
                        title = info.get("title", f"YouTube Audio {temp_id}")
                    duration = float(info.get("duration", 0.0))
                    break
        except Exception:
            pass

        mp3_file = self.bgm_dir / f"yt_{temp_id}.mp3"
        if not mp3_file.exists():
            for f in self.bgm_dir.glob(f"yt_{temp_id}*"):
                if f.suffix == ".mp3":
                    mp3_file = f
                    break

        if not mp3_file.exists():
            raise FileNotFoundError("Конвертированный MP3 файл не найден после скачивания")

        clean_title = re.sub(r"[^\w\s-]", "", title or "yt_track").strip()
        slug = re.sub(r"[\s_]+", "_", clean_title).lower()[:40]
        final_fn = f"{slug}_{temp_id}.mp3"
        final_path = self.bgm_dir / final_fn
        mp3_file.rename(final_path)

        real_dur = self.get_track_duration(final_path) or duration

        track_data = {
            "id": final_fn,
            "filename": final_fn,
            "title": title or clean_title,
            "category": "youtube",
            "duration": round(real_dur, 2),
            "source_url": url
        }

        meta = self._get_metadata()
        meta["tracks"].append(track_data)
        self._save_metadata(meta)

        return track_data

    def save_uploaded_track(self, file_content: bytes, original_filename: str) -> Dict[str, Any]:
        import uuid
        temp_id = str(uuid.uuid4())[:6]
        clean_stem = re.sub(r"[^\w-]", "_", Path(original_filename).stem)[:30]
        fn = f"{clean_stem}_{temp_id}.mp3"
        target_path = self.bgm_dir / fn

        with open(target_path, "wb") as f:
            f.write(file_content)

        dur = self.get_track_duration(target_path)
        track_data = {
            "id": fn,
            "filename": fn,
            "title": Path(original_filename).stem.replace("_", " ").title(),
            "category": "uploaded",
            "duration": dur
        }

        meta = self._get_metadata()
        meta["tracks"].append(track_data)
        self._save_metadata(meta)
        return track_data

    def get_track_file(self, filename: str) -> Optional[Path]:
        path = self.bgm_dir / filename
        if path.exists():
            return path
        return None

bgm_service = BGMService()
