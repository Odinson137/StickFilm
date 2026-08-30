import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.domain.models import ThumbnailOption, ProjectThumbnails, Project
from app.services.project_service import project_service
from app.services.gemini_bot import gemini_bot, get_gemini_style_header
from app.services.script_parser import detect_image_style
from app.core.sanitizer import sanitize_prompt

STYLE_HEADER = (
    "Generate a single standalone viral YouTube thumbnail, 16:9 widescreen aspect ratio. "
    "Style: Vibrant crude MS Paint stick figure meme doodle style (Sam O'Nella / OverSimplified comic style). "
    "Background & Composition: Centered dynamic 16:9 composition with a simple ground baseline, crude humorous background props, bold cartoon starbursts, thick wobbly black marker outlines, and bright flat solid colors. NO random floating text labels in brackets. "
    "Characters: Highly expressive 2D stick figures with crazy dot eyes and derpy meme faces. Strictly 2D, no realistic 3D shading."
)

LEGACY_SPIDERMAN_KEYWORDS = [
    "cringe dance",
    "slicked emo hair",
    "finger-guns",
    "gooey creature",
    "sand monster",
    "wedding ring box",
    "flying glider",
    "spider-man",
    "spiderman"
]

class ThumbnailService:
    @staticmethod
    def extract_project_script(proj: Project) -> str:
        """Извлекает полный сценарий текущего фильма со всеми сценами, озвучкой и визуальными деталями"""
        lines = []
        for s in proj.scenes:
            header = f"Scene {s.id}"
            if s.desc:
                header += f" ({s.desc})"
            scene_text = s.text.strip() if s.text else ""
            lines.append(f"{header}:\nText: {scene_text}")

            prompts = []
            if s.image_prompt and s.image_prompt != s.text and s.image_prompt != s.desc:
                prompts.append(s.image_prompt.strip())
            for img in s.images:
                if img.prompt and img.prompt not in prompts and img.prompt != s.text and img.prompt != s.desc:
                    prompts.append(img.prompt.strip())
            if prompts:
                lines.append(f"Visual details: {'; '.join(prompts[:3])}")
            lines.append("")
        return "\n".join(lines).strip()

    def get_default_prompts(self, proj: Project) -> List[ThumbnailOption]:
        """Генерирует 3 уникальных варианта промптов для превью на основе текущего фильма и его сцен"""
        clean_title = proj.title.replace("Recap", "").strip() or "Movie"
        scenes = proj.scenes or []
        proj_ar = proj.settings.get("aspect_ratio", "16:9")
        is_vertical = (proj_ar == "9:16" or proj_ar == "vertical")
        ar_tag = "9:16" if is_vertical else "16:9"
        ar_desc = "vertical mobile 9:16 portrait composition" if is_vertical else "16:9 widescreen"

        # Вариант 1: Завязка / Главный мем / Абсурд главного героя
        s1_hint = ""
        if len(scenes) > 0:
            s1 = scenes[0]
            s1_hint = f" (inspired by: {s1.desc or s1.text[:90]})"
        prompt_1 = (
            f"A hilarious stick figure movie parody thumbnail for '{clean_title}'. "
            f"In the center, an exaggerated smug or derpy stick figure main character in a ridiculous comical pose with funny meme reaction faces and comical props around them{s1_hint}. "
            f"Vibrant solid colors, thick crude black marker doodle outlines, simple ground baseline, {ar_desc}, {ar_tag}"
        )

        # Вариант 2: Середина фильма / Экшен / Монстры / Масштабный хаос
        mid_hint = ""
        if len(scenes) > 1:
            mid_idx = len(scenes) // 2
            smid = scenes[mid_idx]
            mid_hint = f" (inspired by: {smid.desc or smid.text[:90]})"
        prompt_2 = (
            f"An epic chaotic stick figure action & disaster thumbnail for '{clean_title}'. "
            f"A giant dangerous threat, monster, epic battle, or chaotic disaster scene with tiny screaming stick figures in panic flying with comic speed lines{mid_hint}. "
            f"Vibrant solid colors, thick crude black marker doodle outlines, simple ground baseline, {ar_desc}, {ar_tag}"
        )

        # Вариант 3: Финал / Кульминация / Сюжетный твист / Противостояние
        end_hint = ""
        if len(scenes) > 2:
            send = scenes[-1]
            end_hint = f" (inspired by: {send.desc or send.text[:90]})"
        prompt_3 = (
            f"A dramatic and funny plot breakdown thumbnail for '{clean_title}'. "
            f"Tense confrontation or shocking plot hole standoff between key stick figure characters during the climax{end_hint}. "
            f"Comic sweat drops, question marks doodles, vibrant solid colors, thick crude black marker doodle outlines, ground line, {ar_desc}, {ar_tag}"
        )

        return [
            ThumbnailOption(
                id="thumb_1",
                title="Вариант 1: Главный Мем & Персонаж (Высокий CTR)",
                prompt=prompt_1,
                image_file="thumbnails/thumb_1.png",
                status="pending"
            ),
            ThumbnailOption(
                id="thumb_2",
                title="Вариант 2: Экшен, Хаос & Монстры (Кликбейт)",
                prompt=prompt_2,
                image_file="thumbnails/thumb_2.png",
                status="pending"
            ),
            ThumbnailOption(
                id="thumb_3",
                title="Вариант 3: Сюжетный Твист & Финал (Интрига)",
                prompt=prompt_3,
                image_file="thumbnails/thumb_3.png",
                status="pending"
            ),
        ]

    def get_thumbnails(self, project_id: str, force_refresh: bool = False) -> ProjectThumbnails:
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        thumb_dir = proj_dir / "thumbnails"
        thumb_dir.mkdir(parents=True, exist_ok=True)

        meta_file = thumb_dir / "thumbnails.json"
        default_options = self.get_default_prompts(proj)

        if meta_file.exists() and not force_refresh:
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                options = [ThumbnailOption(**item) for item in data]

                # Проверка: если в сохраненных промптах остались старые захардкоженные Человек-паук промпты,
                # а текущий фильм другой — заменяем на динамические промпты текущего фильма
                is_spiderman_proj = "spider" in proj.title.lower()
                has_stale_spiderman = any(
                    any(kw in opt.prompt.lower() for kw in LEGACY_SPIDERMAN_KEYWORDS)
                    for opt in options
                )

                if has_stale_spiderman and not is_spiderman_proj:
                    options = default_options

                for i, opt in enumerate(options):
                    if i < len(default_options):
                        opt.title = default_options[i].title
                    if opt.image_file and (proj_dir / opt.image_file).exists() and (proj_dir / opt.image_file).stat().st_size > 2000:
                        opt.status = "ready"
                    else:
                        opt.status = "pending"

                with open(meta_file, "w", encoding="utf-8") as f:
                    json.dump([opt.model_dump() for opt in options], f, indent=2, ensure_ascii=False)

                return ProjectThumbnails(project_id=project_id, thumbnails=options)
            except Exception:
                pass

        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump([opt.model_dump() for opt in default_options], f, indent=2, ensure_ascii=False)

        return ProjectThumbnails(project_id=project_id, thumbnails=default_options)

    def refresh_prompts(self, project_id: str) -> ProjectThumbnails:
        """Принудительно пересоздает промпты превью на основе актуального сценария фильма"""
        return self.get_thumbnails(project_id, force_refresh=True)

    def save_thumbnail_options(self, project_id: str, new_options: list) -> ProjectThumbnails:
        proj_dir = project_service.get_project_dir(project_id)
        thumb_dir = proj_dir / 'thumbnails'
        thumb_dir.mkdir(parents=True, exist_ok=True)
        meta_file = thumb_dir / 'thumbnails.json'
        
        current = self.get_thumbnails(project_id).thumbnails
        
        updated = []
        for i, opt in enumerate(new_options):
            existing = next((t for t in current if t.id == opt['id']), None)
            status = existing.status if existing else 'pending'
            image_file = existing.image_file if existing else ''
            updated.append(ThumbnailOption(
                id=opt['id'],
                title=opt.get('title', f'Option {i+1}'),
                prompt=opt['prompt'],
                status=status,
                image_file=image_file
            ))
            
        with open(meta_file, 'w', encoding='utf-8') as f:
            json.dump([opt.model_dump() for opt in updated], f, indent=2, ensure_ascii=False)
            
        return ProjectThumbnails(project_id=project_id, thumbnails=updated)

    def generate_thumbnail(self, project_id: str, thumb_id: str, custom_prompt: str = None) -> ThumbnailOption:
        proj = project_service.get_project(project_id)
        thumbs_obj = self.get_thumbnails(project_id)
        option = next((t for t in thumbs_obj.thumbnails if t.id == thumb_id), None)
        if not option:
            raise ValueError(f"Превью {thumb_id} не найдено")

        raw_prompt = custom_prompt or option.prompt
        safe_prompt = sanitize_prompt(raw_prompt)
        option.prompt = safe_prompt
        option.status = "generating"

        proj_dir = project_service.get_project_dir(project_id)
        out_file = proj_dir / "thumbnails" / f"{thumb_id}.png"
        out_file.parent.mkdir(parents=True, exist_ok=True)

        # Извлекаем полный сценарий фильма
        script_text = self.extract_project_script(proj)
        clean_title = proj.title.replace("Recap", "").strip() or "Movie"
        proj_ar = proj.settings.get("aspect_ratio", "16:9")
        is_vertical = (proj_ar == "9:16" or proj_ar == "vertical")
        ar_tag = "9:16" if is_vertical else "16:9"
        ar_label = "vertical 9:16 mobile thumbnail (for TikTok / Shorts / Reels)" if is_vertical else "16:9 widescreen YouTube thumbnail"

        clean_prompt, img_style = detect_image_style(safe_prompt)
        style_header = get_gemini_style_header(img_style, proj_ar)

        # Инструкция для Gemini по выбору конкретного кадра
        frame_rules = {
            "thumb_1": (
                f"VARIANT 1 (MEME & MAIN CHARACTER FRAME): "
                f"Carefully examine the entire script above and pick the funniest meme moment, main character comedy pose, "
                f"or ridiculous opening/setup from the FIRST part of the movie. Generate a distinct viral {ar_tag} thumbnail for this scene."
            ),
            "thumb_2": (
                f"VARIANT 2 (ACTION, CHAOS & MONSTER FRAME): "
                f"Carefully examine the entire script above and pick a COMPLETELY DIFFERENT high-energy action setpiece, "
                f"monster encounter, battle, or chaotic disaster from the MIDDLE of the movie. Generate a distinct viral {ar_tag} thumbnail for this scene."
            ),
            "thumb_3": (
                f"VARIANT 3 (PLOT TWIST, CLIMAX & STANDOFF FRAME): "
                f"Carefully examine the entire script above and pick a COMPLETELY DIFFERENT dramatic climax confrontation, "
                f"shocking plot twist, or intense rivalry standoff from the ENDING of the movie. Generate a distinct viral {ar_tag} thumbnail for this scene."
            )
        }
        variant_instruction = frame_rules.get(thumb_id, f"Pick a distinct and visually striking scene from the script above. Format: {ar_tag}.")

        # Формируем полный промпт с полным сценарием и требованием найти разные кадры
        script_block = f"\n\n=== COMPLETE SCRIPT FOR '{clean_title.upper()}': ===\n{script_text}\n========================================\n\n" if script_text else ""
        full_prompt = (
            f"{style_header}\n\n"
            f"TASK: Generate a single standalone viral {ar_label} specifically for '{clean_title}' based on the script above.\n"
            f"ASPECT RATIO: Strictly {ar_tag} ({'vertical mobile portrait' if is_vertical else 'horizontal widescreen'}).\n"
            f"TEXT & COMPOSITION: Include huge high-contrast reaction text or comic sound effects prominently on the image.\n"
            f"{script_block}"
            f"FRAME SELECTION: {variant_instruction}\n"
            f"SPECIFIC VISUAL DIRECTION: {clean_prompt}\n"
            f"--ar {ar_tag}"
        )
        safe_full_prompt = sanitize_prompt(full_prompt)

        # Generate via playwright
        from playwright.sync_api import sync_playwright
        from playwright_stealth import Stealth
        import random, time, requests, base64

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(gemini_bot.profile_dir),
                channel="chrome",
                headless=False,
                ignore_default_args=["--enable-automation"],
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                    "--no-first-run",
                    "--no-default-browser-check"
                ]
            )
            page = context.pages[0] if context.pages else context.new_page()
            Stealth().apply_stealth_sync(page)
            page.goto("https://gemini.google.com/app")
            time.sleep(random.uniform(2.5, 4.0))

            # Open clean new chat for fresh generation
            gemini_bot.open_new_chat(page)

            # Record existing images before inserting prompt
            initial_srcs = page.evaluate("() => Array.from(document.querySelectorAll('img')).map(i => i.src || i.currentSrc || '').filter(Boolean)")
            initial_count = len(page.locator("button.image-button img, img.image, img.loaded, img[src*='blob:'], img[src*='googleusercontent']").all())

            gemini_bot.safe_insert_prompt(page, safe_full_prompt)
            gemini_bot.safe_send_prompt(page)

            img_saved = gemini_bot.capture_image_from_gemini(page, out_file, initial_img_count=initial_count, initial_srcs=initial_srcs)

            context.close()

        if img_saved and out_file.exists() and out_file.stat().st_size > 2000:
            gemini_bot.ensure_pure_png(out_file)
            option.image_file = f"thumbnails/{thumb_id}.png"
            option.status = "ready"
        else:
            option.status = "error"

        meta_file = proj_dir / "thumbnails" / "thumbnails.json"
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump([opt.model_dump() for opt in thumbs_obj.thumbnails], f, indent=2, ensure_ascii=False)

        return option

thumbnail_service = ThumbnailService()
