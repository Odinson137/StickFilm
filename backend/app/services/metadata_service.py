import os
import json
from pathlib import Path
from typing import Dict, Any, List
from app.services.project_service import project_service

class MetadataService:
    def generate_project_metadata(self, project_id: str) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        output_dir = proj_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        clean_title = proj.title.replace("Recap", "").strip()
        eng_title = proj.settings.get("eng_title", clean_title)

        # 1. Full YouTube Video Metadata
        yt_title = f"{eng_title} Recap In 3 Minutes (Hilarious Stickman Animation)"
        yt_desc = (
            f"Here is the fastest and funniest stickman recap of {eng_title}!\n\n"
            f"🎬 Watch how our stick figure hero tackles cringe dancing, awkward drama, and chaotic villains in under 3 minutes.\n\n"
            f"🔔 Subscribe for more weekly minimalist stick figure movie recaps!\n"
            f"👍 Leave a like if you enjoyed the animation!\n\n"
            f"#stickman #animation #recap #movieexplained #funny #parody"
        )
        yt_tags = [
            f"{eng_title.lower()} recap",
            f"{eng_title.lower()} summary",
            f"{eng_title.lower()} in 3 minutes",
            "stickman animation",
            "movie recap",
            "movie recap stickman",
            "sam o nella style",
            "animation parody",
            "funny animation",
            "animated summary",
            "movie explained in minutes",
            "stick figure animation"
        ]

        # 2. YouTube Shorts Metadata (for each short part)
        shorts_meta = []
        # Check actual shorts count in output
        shorts_dir = output_dir / "shorts"
        num_shorts = len([f for f in shorts_dir.iterdir() if f.is_file() and f.suffix == ".mp4"]) if shorts_dir.exists() else 3
        num_shorts = max(1, num_shorts)

        for i in range(1, num_shorts + 1):
            s_title = f"If {eng_title} Was A Stickman Cartoon - Part {i} #shorts"
            s_desc = (
                f"{eng_title} stick figure recap - Part {i} / {num_shorts}!\n\n"
                f"Watch the full 3-minute recap on the channel! 🎬\n\n"
                f"#shorts #stickman #animation #recap #funny #meme #viral"
            )
            s_tags = ["shorts", "stickman", "animation", "recap", f"{eng_title.lower()} shorts", "funny", "meme"]
            shorts_meta.append({
                "part": i,
                "title": s_title,
                "description": s_desc,
                "tags": ", ".join(s_tags)
            })

        # 3. TikToks / Reels Metadata (Description with viral hashtags only)
        tiktoks_meta = []
        tiktoks_dir = output_dir / "tiktoks"
        num_tiktoks = len([f for f in tiktoks_dir.iterdir() if f.is_file() and f.suffix == ".mp4"]) if tiktoks_dir.exists() else 2
        num_tiktoks = max(1, num_tiktoks)

        for i in range(1, num_tiktoks + 1):
            tk_desc = (
                f"When you try to summarize {eng_title} in MS Paint style 💀 (Part {i}/{num_tiktoks}) "
                f"#stickman #animation #recap #movierecap #funny #fyp #foryou #viral #comedy #animationmeme #cartoon"
            )
            tiktoks_meta.append({
                "part": i,
                "description_with_tags": tk_desc
            })

        result = {
            "project_id": project_id,
            "project_title": proj.title,
            "youtube_full": {
                "title": yt_title,
                "description": yt_desc,
                "tags": ", ".join(yt_tags)
            },
            "youtube_shorts": shorts_meta,
            "tiktoks": tiktoks_meta
        }

        # Save to TXT file for easy viewing in Explorer
        txt_file = output_dir / "publishing_metadata.txt"
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write("=" * 65 + "\n")
            f.write(f"  МЕТАДАННЫЕ И ТЕГИ ДЛЯ ПУБЛИКАЦИИ: {proj.title.upper()}\n")
            f.write("=" * 65 + "\n\n")

            f.write("═════════════════════════════════════════════════════════════════\n")
            f.write("1. ОСНОВНОЕ ПОЛНОЕ ВИДЕО (YOUTUBE 1080P)\n")
            f.write("═════════════════════════════════════════════════════════════════\n")
            f.write(f"📌 НАЗВАНИЕ (TITLE):\n{yt_title}\n\n")
            f.write(f"📝 ОПИСАНИЕ (DESCRIPTION):\n{yt_desc}\n\n")
            f.write(f"🏷️ ТЕГИ (TAGS):\n{', '.join(yt_tags)}\n\n\n")

            f.write("═════════════════════════════════════════════════════════════════\n")
            f.write("2. YOUTUBE SHORTS (ДЛЯ КАЖДОЙ ЧАСТИ)\n")
            f.write("═════════════════════════════════════════════════════════════════\n")
            for sm in shorts_meta:
                f.write(f"--- [ Shorts Часть {sm['part']} ] ---\n")
                f.write(f"📌 Название: {sm['title']}\n")
                f.write(f"📝 Описание:\n{sm['description']}\n")
                f.write(f"🏷️ Теги: {sm['tags']}\n\n")

            f.write("\n═════════════════════════════════════════════════════════════════\n")
            f.write("3. TIKTOKS & INSTAGRAM REELS (ОПИСАНИЕ + ТЕГИ)\n")
            f.write("═════════════════════════════════════════════════════════════════\n")
            for tm in tiktoks_meta:
                f.write(f"--- [ TikTok / Reels Часть {tm['part']} ] ---\n")
                f.write(f"📝 Описание с тегами:\n{tm['description_with_tags']}\n\n")

        # Save to JSON file as well
        json_file = output_dir / "publishing_metadata.json"
        with open(json_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        return result

    def get_metadata(self, project_id: str) -> Dict[str, Any]:
        proj_dir = project_service.get_project_dir(project_id)
        json_file = proj_dir / "output" / "publishing_metadata.json"
        if json_file.exists():
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return self.generate_project_metadata(project_id)

metadata_service = MetadataService()
