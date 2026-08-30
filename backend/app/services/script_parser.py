import re
import json
from typing import List, Dict, Any, Optional, Tuple
from app.domain.models import Scene, SceneImage

def detect_image_style(text: str) -> tuple[str, str]:
    """Извлекает тег стиля и возвращает (clean_prompt, style_id)"""
    style = "storytime_2d"
    clean = text.strip()

    # 1. Match explicit style tag [Style: ...] or (Style: ...)
    tag_m = re.search(r"[\[\(](?:style|стиль):\s*([\w-]+)[\]\)]", clean, re.IGNORECASE)
    if tag_m:
        raw_s = tag_m.group(1).lower().replace("-", "_")
        if raw_s in ["storytime_2d", "storytime", "webtoon", "2d"]:
            style = "storytime_2d"
        elif raw_s in ["paper_cutout", "paper", "cutout", "collage"]:
            style = "paper_cutout"
        elif raw_s in ["vintage_comic", "comic", "pop_art", "popart"]:
            style = "vintage_comic"
        elif raw_s in ["retro_16bit", "pixel_art", "16bit", "pixel", "snes"]:
            style = "retro_16bit"
        elif raw_s in ["rubber_hose_1930s", "rubber_hose", "1930s", "vintage_cartoon"]:
            style = "rubber_hose_1930s"
        elif raw_s in ["sharpie_notebook", "sharpie", "notebook", "doodle"]:
            style = "sharpie_notebook"
        clean = re.sub(r"[\[\(](?:style|стиль):\s*[\w-]+[\]\)]", "", clean, flags=re.IGNORECASE).strip(" :-")

    # 2. Heuristic keywords if no explicit tag
    lower = clean.lower()
    if any(k in lower for k in ["paper cutout", "cut paper", "construction paper", "бумажная аппликация", "вырезанная бумага"]):
        style = "paper_cutout"
    elif any(k in lower for k in ["comic book", "pop-art", "pop art", "ben-day", "halftone", "комикс", "поп-арт"]):
        style = "vintage_comic"
    elif any(k in lower for k in ["pixel art", "16-bit", "pixelated", "пиксель", "пиксель-арт"]):
        style = "retro_16bit"
    elif any(k in lower for k in ["rubber hose", "1930s", "pie eyes", "sepia tint", "капхед", "мультфильм 1930"]):
        style = "rubber_hose_1930s"
    elif any(k in lower for k in ["sharpie", "notebook paper", "lined paper", "маркер", "тетрад", "блокнот"]):
        style = "sharpie_notebook"

    return clean, style

class ScriptParser:
    parse = None

    @staticmethod
    def parse_script(text: str) -> tuple[List[Scene], Optional[Dict[str, Any]], Optional[List[Dict[str, str]]]]:
        text = text.strip()
        if not text:
            return [], None, None

        settings = {"movie_passport": {}, "bgm": {}, "subtitles": {}}
        thumbnails = None

        # 1. Parse MOVIE PASSPORT
        passport_match = re.search(r"MOVIE PASSPORT:(.*?)(?:SCENE 1|THUMBNAILS:|$)", text, re.IGNORECASE | re.DOTALL)
        if passport_match:
            settings = {"movie_passport": {}, "bgm": {}, "subtitles": {}}
            p_text = passport_match.group(1)
            
            genre_m = re.search(r"-\s*Genre:\s*([^\n]+)", p_text, re.IGNORECASE)
            if genre_m:
                settings["movie_passport"]["genre"] = genre_m.group(1).strip()
            
            chars_m = re.search(r"-\s*Characters:\s*([\s\S]*?)(?:-\s*BGM|-\s*Subtitles|$)", p_text, re.IGNORECASE)
            if chars_m:
                settings["movie_passport"]["characters"] = chars_m.group(1).strip()

            bgm_m = re.search(r"-\s*BGM[^\n:]*:\s*([^\n]+)", p_text, re.IGNORECASE)
            if bgm_m:
                settings["bgm"]["track"] = bgm_m.group(1).strip()
            
            subs_m = re.search(r"-\s*Subtitles:\s*([\s\S]*?)(?:-\s*Genre|-\s*Characters|-\s*BGM|$)", p_text, re.IGNORECASE)
            if subs_m:
                subs_text = subs_m.group(1)
                font_m = re.search(r"-\s*Font:\s*([^\n]+)", subs_text, re.IGNORECASE)
                if font_m: settings["subtitles"]["font"] = font_m.group(1).strip()
                color_m = re.search(r"-\s*Highlight Color:\s*([^\n]+)", subs_text, re.IGNORECASE)
                if color_m: settings["subtitles"]["highlight_color"] = color_m.group(1).strip()
                anim_m = re.search(r"-\s*Animation:\s*([^\n]+)", subs_text, re.IGNORECASE)
                if anim_m: settings["subtitles"]["animation"] = anim_m.group(1).strip()

        # 2. Parse THUMBNAILS
        thumb_match = re.search(r"THUMBNAILS:(.*?)(?:SHORTS BUMPERS:|SCENE 1|$)", text, re.IGNORECASE | re.DOTALL)
        if thumb_match:
            thumbnails = []
            t_text = thumb_match.group(1)
            t_items = re.findall(r"-\s*Option\s*\d*:\s*(.*?)\n\s*Prompt:\s*([^\n]+)", t_text, re.IGNORECASE)
            if not t_items:
                t_items = re.findall(r"\[THUMB_\d+\]\s*(.*?):\s*([^\n]+)", t_text, re.IGNORECASE)
            for i, (title, prompt) in enumerate(t_items, 1):
                thumbnails.append({"id": f"thumb_{i}", "title": title.strip(), "prompt": prompt.strip()})

        # 3. Parse SHORTS BUMPERS
        bumpers_match = re.search(r"SHORTS BUMPERS:(.*?)(?:SCENE 1|$)", text, re.IGNORECASE | re.DOTALL)
        if bumpers_match:
            bumpers_text = bumpers_match.group(1)
            intro_m = re.search(r"-\s*Intro Template:\s*\n\s*Prompt:\s*([^\n]+)", bumpers_text, re.IGNORECASE)
            outro_m = re.search(r"-\s*Outro Template:\s*\n\s*Prompt:\s*([^\n]+)", bumpers_text, re.IGNORECASE)
            if intro_m or outro_m:
                settings.setdefault("shorts_bumpers", {})
                if intro_m:
                    settings["shorts_bumpers"]["intro_template"] = intro_m.group(1).strip()
                if outro_m:
                    settings["shorts_bumpers"]["outro_template"] = outro_m.group(1).strip()

        # Remove header blocks before parsing scenes
        text = re.sub(r"MOVIE PASSPORT:.*?SCENE 1", "SCENE 1", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"THUMBNAILS:.*?SCENE 1", "SCENE 1", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"SHORTS BUMPERS:.*?SCENE 1", "SCENE 1", text, flags=re.IGNORECASE | re.DOTALL)

        # 1. Try parsing JSON format
        if text.startswith("[") and text.endswith("]"):
            try:
                data = json.loads(text)
                scenes = []
                for idx, item in enumerate(data, 1):
                    raw_shot = item.get("shot_id") or item.get("shot") or f"shot_{idx:02d}"
                    clean_shot = re.sub(r"[^\w-]", "", raw_shot.strip())
                    
                    # Check if images list provided in JSON
                    raw_imgs = item.get("images", [])
                    images = []
                    if raw_imgs:
                        for i_idx, r_img in enumerate(raw_imgs, 1):
                            img_id = r_img.get("id") or f"img_{i_idx}"
                            raw_p = r_img.get("prompt", "")
                            clean_p, img_style = detect_image_style(raw_p)
                            if r_img.get("style"):
                                img_style = r_img.get("style")
                            fn = r_img.get("image_file") or (f"shots/{clean_shot}.png" if i_idx == 1 else f"shots/{clean_shot}_{img_id}.png")
                            images.append(SceneImage(
                                id=img_id,
                                image_file=fn,
                                prompt=clean_p,
                                style=img_style,
                                start_time=float(r_img.get("start_time", 0.0)),
                                duration=float(r_img.get("duration", 0.0)) if r_img.get("duration") else None,
                                status="pending"
                            ))
                    else:
                        raw_p = item.get("image_prompt", item.get("prompt", ""))
                        clean_p, img_style = detect_image_style(raw_p)
                        images.append(SceneImage(
                            id="img_1",
                            image_file=f"shots/{clean_shot}.png",
                            prompt=clean_p,
                            style=img_style,
                            start_time=0.0,
                            status="pending"
                        ))

                    first_style = images[0].style if images else "storytime_2d"
                    scenes.append(Scene(
                        id=idx,
                        shot_id=clean_shot,
                        timing=item.get("timing", ""),
                        text=item.get("voiceover", item.get("text", "")),
                        desc=item.get("description", item.get("desc", "")),
                        image_prompt=item.get("image_prompt", item.get("prompt", "")),
                        style=first_style,
                        image_file=f"shots/{clean_shot}.png",
                        audio_file=f"audio/voice_{idx:02d}.mp3",
                        images=images
                    ))
                return scenes, settings, thumbnails
            except Exception:
                pass

        # 2. Try parsing Modern Structured Scene Format (СЦЕНА 1 / SCENE 1 with [IMG_X] tags)
        if re.search(r"(сцена|scene)\s*\d+", text, re.IGNORECASE):
            scene_blocks = re.split(r"(?=(?:^|\n)(?:[-—=]{3,}\s*)?(?:сцена|scene)\s*\d+)", text, flags=re.IGNORECASE)
            parsed_scenes = []
            
            for block in scene_blocks:
                block_str = block.strip().strip("-—=")
                if not block_str or not re.search(r"(сцена|scene)\s*\d+", block_str, re.IGNORECASE):
                    continue

                idx = len(parsed_scenes) + 1
                clean_shot = f"shot_{idx:02d}"

                # Extract title
                header_match = re.search(r"(?:сцена|scene)\s*(\d+)[\s:\.\-\(]*(.*?)(?:\)|:|\n|$)", block_str, re.IGNORECASE)
                scene_title = header_match.group(2).strip(" ()-:") if header_match else ""

                # Extract Text section
                text_content = ""
                text_match = re.search(r"(?:текст|озвучка|voiceover|text)(?:[^\n:]*)?[\s:\-\(]*\n?([\s\S]*?)(?=(?:промпт|prompts|images|кадры|---|\n\n\n|$))", block_str, re.IGNORECASE)
                if text_match:
                    text_content = text_match.group(1).strip().strip("«»\"")
                else:
                    parts = re.split(r"(?:промпт|prompts|images|кадры):", block_str, flags=re.IGNORECASE)
                    if len(parts) > 1:
                        text_content = parts[0].replace(header_match.group(0) if header_match else "", "").strip().strip("«»\"")

                # Extract Prompts section
                prompts_dict: Dict[str, str] = {}
                prompt_lines = re.findall(r"[-*•]?\s*\[?(img_\d+|animation_\w+|img\s*\d+|кадр\s*\d+)\]?[\s:\-]+([^\n]+)", block_str, re.IGNORECASE)
                for p_tag, p_text in prompt_lines:
                    clean_tag = re.sub(r"[^\w-]", "", p_tag.lower())
                    clean_tag = clean_tag.replace("кадр", "img_").replace("img", "img_").replace("__", "_")
                    prompts_dict[clean_tag] = p_text.strip()

                # Clean text for TTS
                clean_vo_text = text_content
                clean_vo_text = re.sub(r"^(?:текст|озвучка|voiceover|text)[^\n:]*:\s*", "", clean_vo_text, flags=re.IGNORECASE)
                clean_vo_text = re.sub(r"\[(img_\d+|img\s*\d+|кадр\s*\d+)\]", "", clean_vo_text, flags=re.IGNORECASE)
                clean_vo_text = re.sub(r"\[animation[_\w]*:[^\]]+\]", "", clean_vo_text, flags=re.IGNORECASE)
                clean_vo_text = re.sub(r"\[animation[_\w]*\]", "", clean_vo_text, flags=re.IGNORECASE)
                clean_vo_text = re.sub(r"\s+", " ", clean_vo_text).strip(" «»\"'")

                # Build SceneImage list from markers or extracted prompts
                images: List[SceneImage] = []
                img_tags = re.findall(r"\[(img_\d+|animation_\w+|img\s*\d+|кадр\s*\d+)(?::[^\]]+)?\]", text_content, re.IGNORECASE)
                
                if img_tags:
                    for i_idx, tag in enumerate(img_tags, 1):
                        tag_key = re.sub(r"[^\w-]", "", tag.lower()).replace("кадр", "img_").replace("img", "img_").replace("__", "_")
                        raw_prompt = prompts_dict.get(tag_key, "")
                        if not raw_prompt and i_idx == 1:
                            raw_prompt = clean_vo_text or scene_title
                        
                        clean_prompt, img_style = detect_image_style(raw_prompt)
                        img_id = f"img_{i_idx}"
                        fn = f"shots/{clean_shot}.png" if i_idx == 1 else f"shots/{clean_shot}_{img_id}.png"
                        images.append(SceneImage(
                            id=img_id,
                            image_file=fn,
                            prompt=clean_prompt or f"Scene for {clean_vo_text[:50]}, 9:16",
                            style=img_style,
                            start_time=0.0 if i_idx == 1 else (i_idx - 1) * 2.0,
                            status="pending"
                        ))
                elif prompts_dict:
                    for i_idx, (tag_key, raw_prompt) in enumerate(prompts_dict.items(), 1):
                        clean_prompt, img_style = detect_image_style(raw_prompt)
                        img_id = f"img_{i_idx}"
                        fn = f"shots/{clean_shot}.png" if i_idx == 1 else f"shots/{clean_shot}_{img_id}.png"
                        images.append(SceneImage(
                            id=img_id,
                            image_file=fn,
                            prompt=clean_prompt,
                            style=img_style,
                            start_time=0.0 if i_idx == 1 else (i_idx - 1) * 2.0,
                            status="pending"
                        ))
                else:
                    images.append(SceneImage(
                        id="img_1",
                        image_file=f"shots/{clean_shot}.png",
                        prompt=clean_vo_text or scene_title or f"Scene {idx}",
                        style="storytime_2d",
                        start_time=0.0,
                        status="pending"
                    ))

                first_prompt = images[0].prompt if images else clean_vo_text
                first_style = images[0].style if images else "storytime_2d"

                parsed_scenes.append(Scene(
                    id=idx,
                    shot_id=clean_shot,
                    timing="",
                    text=clean_vo_text or text_content or scene_title,
                    desc=scene_title or clean_vo_text[:60],
                    image_prompt=first_prompt,
                    style=first_style,
                    image_file=f"shots/{clean_shot}.png",
                    audio_file=f"audio/voice_{idx:02d}.mp3",
                    images=images
                ))

            if parsed_scenes:
                return parsed_scenes, settings, thumbnails

        # 3. Try parsing Markdown Table
        lines = text.splitlines()
        table_rows = []
        is_first_content_row = True
        
        for line in lines:
            trimmed = line.strip()
            if trimmed.startswith("|") and trimmed.endswith("|"):
                cells = [c.strip() for c in trimmed.split("|")[1:-1]]
                if not cells:
                    continue
                if all(set(c).issubset({"-", ":", " "}) for c in cells):
                    continue
                col0 = cells[0].lower().strip()
                if col0 in ["shot", "shot #", "scene", "id", "№", "кадр", "номер"]:
                    continue
                if is_first_content_row and any(c.lower() in ["voiceover", "voiceover (en)", "visual scene description", "image prompt", "timing"] for c in cells):
                    is_first_content_row = False
                    continue
                    
                is_first_content_row = False
                table_rows.append(cells)

        if table_rows:
            scenes = []
            for idx, cells in enumerate(table_rows, 1):
                raw_shot_col = cells[0] if len(cells) > 0 else f"shot_{idx:02d}"
                clean_shot = re.sub(r"[^\w-]", "", raw_shot_col.replace("*", "").strip()) or f"shot_{idx:02d}"
                
                timing_col = cells[1] if len(cells) > 1 else ""
                vo_col = cells[2] if len(cells) > 2 else ""
                desc_col = cells[3] if len(cells) > 3 else ""
                prompt_col = cells[4] if len(cells) > 4 else desc_col

                if len(cells) == 3:
                    vo_col = cells[1]
                    prompt_col = cells[2]
                    desc_col = prompt_col
                elif len(cells) == 4:
                    timing_col = cells[1]
                    vo_col = cells[2]
                    prompt_col = cells[3]
                    desc_col = prompt_col

                scenes.append(Scene(
                    id=idx,
                    shot_id=clean_shot,
                    timing=timing_col.replace("`", "").replace("[", "").replace("]", ""),
                    text=vo_col.strip('"*'),
                    desc=desc_col.strip('"*'),
                    image_prompt=prompt_col.strip('"*'),
                    image_file=f"shots/{clean_shot}.png",
                    audio_file=f"audio/voice_{idx:02d}.mp3",
                    images=[
                        SceneImage(
                            id="img_1",
                            image_file=f"shots/{clean_shot}.png",
                            prompt=prompt_col.strip('"*'),
                            start_time=0.0,
                            status="pending"
                        )
                    ]
                ))
            return scenes, settings, thumbnails

        # 4. Fallback: Parse line-by-line / numbered format
        scenes = []
        current_scene = None
        
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            num_match = re.match(r"^(\d+[\w\-]*)[\.\)]\s*(.*)", line_str)
            if num_match:
                if current_scene:
                    scenes.append(current_scene)
                
                s_label = num_match.group(1)
                s_content = num_match.group(2).strip()
                idx = len(scenes) + 1
                current_scene = Scene(
                    id=idx,
                    shot_id=f"shot_{s_label}",
                    text=s_content,
                    desc=s_content,
                    image_prompt=s_content,
                    image_file=f"shots/shot_{s_label}.png",
                    audio_file=f"audio/voice_{idx:02d}.mp3",
                    images=[
                        SceneImage(
                            id="img_1",
                            image_file=f"shots/shot_{s_label}.png",
                            prompt=s_content,
                            start_time=0.0,
                            status="pending"
                        )
                    ]
                )
            elif current_scene:
                if "prompt:" in line_str.lower():
                    prompt_val = re.sub(r"^prompt:\s*", "", line_str, flags=re.I)
                    current_scene.image_prompt = prompt_val
                    if current_scene.images:
                        current_scene.images[0].prompt = prompt_val
                elif "desc:" in line_str.lower() or "visual:" in line_str.lower():
                    current_scene.desc = re.sub(r"^(desc|visual):\s*", "", line_str, flags=re.I)
                else:
                    current_scene.text += " " + line_str

        if current_scene:
            scenes.append(current_scene)

        return scenes, settings, thumbnails

script_parser = ScriptParser()
ScriptParser.parse = staticmethod(ScriptParser.parse_script)
