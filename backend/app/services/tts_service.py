import os
import sys
import time
import subprocess
import requests
from pathlib import Path
from typing import Dict, Any, Optional
from app.core.config import (
    CHATTERBOX_PYTHON,
    CHATTERBOX_MAIN,
    DEFAULT_VOICE_REF,
)
from app.services.project_service import project_service

class TTSService:
    @staticmethod
    def get_audio_duration(file_path: Path) -> float:
        if not file_path.exists():
            return 0.0
        cmd = [
            "ffprobe", "-v", "error", "-show_entries",
            "format=duration", "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path)
        ]
        try:
            result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
            return float(result.stdout.strip())
        except Exception:
            return 2.5

    def generate_speech_local(self, text: str, output_file: Path, voice_ref_path: Optional[str] = None) -> float:
        """Локальная генерация речи через нейросеть Chatterbox Turbo с клонированием голоса и тегами"""
        output_file.parent.mkdir(parents=True, exist_ok=True)
        temp_wav = output_file.parent / f"temp_{output_file.stem}.wav"

        voice_ref = Path(voice_ref_path) if voice_ref_path and Path(voice_ref_path).exists() else DEFAULT_VOICE_REF

        import re
        # Clean unwanted emotion tags from speech text
        clean_text = re.sub(r"\[(?:sigh|happy|chuckle|sarcastic)\]", "", text, flags=re.IGNORECASE)
        clean_text = re.sub(r"\s+", " ", clean_text).strip()

        cmd = [
            str(CHATTERBOX_PYTHON),
            str(CHATTERBOX_MAIN),
            "--turbo",
            "--text", clean_text,
            "--output", str(temp_wav),
        ]
        if voice_ref and voice_ref.exists():
            cmd.extend(["--ref", str(voice_ref)])

        print(f"[*] Запуск локальной генерации Chatterbox Turbo: \"{text[:45]}...\"")
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=300)
        if res.returncode != 0:
            raise RuntimeError(f"Chatterbox TTS Error (code {res.returncode}):\n{res.stderr}\n{res.stdout}")

        if not temp_wav.exists():
            raise RuntimeError(f"Chatterbox TTS failed to produce {temp_wav}")

        # Конвертация в MP3 (или переименование)
        if output_file.suffix.lower() == ".mp3":
            conv_cmd = ["ffmpeg", "-y", "-i", str(temp_wav), "-b:a", "192k", str(output_file)]
            subprocess.run(conv_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
            if temp_wav.exists():
                temp_wav.unlink()
        else:
            if output_file.exists():
                output_file.unlink()
            temp_wav.rename(output_file)

        return self.get_audio_duration(output_file)

    def generate_speech_for_text(self, text: str, output_file: Path, voice_id: Optional[str] = None) -> float:
        """Исключительно локальная генерация речи через Chatterbox Turbo"""
        return self.generate_speech_local(text, output_file, voice_ref_path=voice_id)

    def generate_single_scene_audio(self, project_id: str, scene_id: int, custom_text: Optional[str] = None) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена с id {scene_id} не найдена")

        text_to_speak = custom_text or scene.text
        if not text_to_speak.strip():
            raise ValueError("Текст реплики не может быть пустым")

        proj_dir = project_service.get_project_dir(project_id)
        out_file = proj_dir / "audio" / f"voice_{scene_id:02d}.mp3"

        scene.audio_status = "generating"
        project_service.save_project(proj)

        try:
            dur = self.generate_speech_for_text(text_to_speak, out_file, proj.settings.get("voice_id"))
            scene.audio_file = f"audio/voice_{scene_id:02d}.mp3"
            scene.audio_duration = dur
            scene.audio_status = "ready"
            project_service.save_project(proj)
            return {
                "success": True,
                "scene_id": scene_id,
                "duration": dur,
                "audio_file": scene.audio_file,
                "file": scene.audio_file,
            }
        except Exception as e:
            scene.audio_status = "error"
            project_service.save_project(proj)
            raise e

    def generate_all_scenes_audio(self, project_id: str) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        
        success_count = 0
        errors = []

        for scene in proj.scenes:
            if not scene.text.strip():
                continue
                
            out_file = proj_dir / "audio" / f"voice_{scene.id:02d}.mp3"
            # Skip if already exists
            if out_file.exists() and out_file.stat().st_size > 1000:
                scene.audio_file = f"audio/voice_{scene.id:02d}.mp3"
                scene.audio_duration = self.get_audio_duration(out_file)
                scene.audio_status = "ready"
                success_count += 1
                continue

            try:
                dur = self.generate_speech_for_text(scene.text, out_file, proj.settings.get("voice_id"))
                scene.audio_file = f"audio/voice_{scene.id:02d}.mp3"
                scene.audio_duration = dur
                scene.audio_status = "ready"
                success_count += 1
            except Exception as e:
                scene.audio_status = "error"
                errors.append(f"Сцена {scene.id}: {str(e)}")
            
            project_service.save_project(proj)
            time.sleep(0.1)

        project_service.save_project(proj)
        return {
            "total": len(proj.scenes),
            "generated": success_count,
            "errors": errors
        }

tts_service = TTSService()
