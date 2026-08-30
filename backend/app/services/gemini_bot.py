import os
import sys
import time
import random
import base64
import requests

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass
from pathlib import Path
from typing import Dict, Any, Optional
from PIL import Image
from playwright.sync_api import sync_playwright, Page
from playwright_stealth import Stealth
from app.core.config import CHROME_PROFILE_DIR
from app.services.project_service import project_service
from app.core.sanitizer import sanitize_prompt

STYLE_PRESETS: Dict[str, Dict[str, str]] = {
    "storytime_2d": {
        "name": "Storytime 2D (Webtoon)",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration in 2D storytime webtoon animator style (expressive cartoon character with round white head and clean features, thick black outlines, flat solid vibrant colors, minimal clean background, vertical mobile composition). Strictly 2D, NO text labels, NO watermarks, perfectly framed 9:16 portrait.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration in 2D storytime webtoon animator style (expressive cartoon character with round white head and clean features, thick black outlines, flat solid vibrant colors, minimal clean background, horizontal composition). Strictly 2D, NO text labels, NO watermarks, perfectly framed 16:9."
    },
    "paper_cutout": {
        "name": "Paper Cutout Collage",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration in satirical layered paper cutout collage style (quirky stop-motion cut-paper look, rough scissor-cut edges, textured colored craft paper, flat drop shadows between paper layers, vertical mobile framing). Strictly 2D, NO text labels, NO watermarks, 9:16 composition.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration in satirical layered paper cutout collage style (quirky stop-motion cut-paper look, rough scissor-cut edges, textured colored craft paper, flat drop shadows between paper layers). Strictly 2D, NO text labels, NO watermarks, 16:9 composition."
    },
    "vintage_comic": {
        "name": "Vintage Comic Pop-Art",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration in vintage 1960s comic book pop-art style (bold halftone Ben-Day dots texture, dramatic black ink cross-hatching, high-contrast dynamic angles, vibrant retro pop-art colors, vertical composition). Strictly 2D, NO floating text words, NO watermarks, 9:16 composition.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration in vintage 1960s comic book pop-art style (bold halftone Ben-Day dots texture, dramatic black ink cross-hatching, high-contrast dynamic angles, vibrant retro pop-art colors). Strictly 2D, NO floating text words, NO watermarks, 16:9 composition."
    },
    "retro_16bit": {
        "name": "Retro 16-bit Pixel Art",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration in detailed 16-bit retro pixel art style (classic arcade video game graphics, clean pixel grid, vibrant nostalgic color palette, vertical framing). Strictly 2D pixel art, NO watermarks, 9:16 vertical composition.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration in detailed 16-bit retro pixel art style (classic arcade video game graphics, clean pixel grid, vibrant nostalgic color palette). Strictly 2D pixel art, NO watermarks, 16:9 composition."
    },
    "rubber_hose_1930s": {
        "name": "1930s Rubber Hose",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration in 1930s vintage rubber hose cartoon style (noodle-like stretchy limbs, classic pie eyes, vintage sepia and black-and-white tint, authentic scratchy film grain and dust texture, vertical composition). Strictly 2D, NO watermarks, 9:16 composition.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration in 1930s vintage rubber hose cartoon style (noodle-like stretchy limbs, classic pie eyes, vintage sepia and black-and-white tint, authentic scratchy film grain and dust texture). Strictly 2D, NO watermarks, 16:9 composition."
    },
    "sharpie_notebook": {
        "name": "Sharpie Notebook Doodle",
        "9:16": "Generate a single standalone 9:16 vertical portrait illustration of a raw hand-drawn cartoon doodle drawn with a black Sharpie marker on real blue-lined school notebook paper (bleeding marker ink lines, neon highlighter accents, authentic paper texture with margins, vertical framing). Strictly 2D, NO watermarks, 9:16 composition.",
        "16:9": "Generate a single standalone 16:9 widescreen illustration of a raw hand-drawn cartoon doodle drawn with a black Sharpie marker on real blue-lined school notebook paper (bleeding marker ink lines, neon highlighter accents, authentic paper texture with margins). Strictly 2D, NO watermarks, 16:9 composition."
    }
}

def get_gemini_style_header(style_key: Optional[str] = None, aspect_ratio: str = "16:9") -> str:
    is_vertical = (aspect_ratio == "9:16" or aspect_ratio == "vertical")
    ar_key = "9:16" if is_vertical else "16:9"
    
    clean_style = (style_key or "").lower().strip()
    if clean_style in STYLE_PRESETS:
        return STYLE_PRESETS[clean_style][ar_key]
    
    # Matching keywords if partial
    for k, v in STYLE_PRESETS.items():
        if k in clean_style or clean_style in k:
            return v[ar_key]

    return STYLE_PRESETS["storytime_2d"][ar_key]

class GeminiBot:
    def __init__(self):
        self.profile_dir = CHROME_PROFILE_DIR
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.stealth = Stealth()
        self.batch_status = {}
        self._stop_requested = set()

    @staticmethod
    def ensure_pure_png(file_path: Path):
        try:
            im = Image.open(file_path)
            im.convert("RGB").save(file_path, "PNG")
        except Exception as e:
            print(f"Warning converting image to PNG: {e}")

    @staticmethod
    def human_mouse_move_and_click(page: Page, locator):
        """Эмуляция плавного человеческого движения мыши к элементу с джиттером"""
        try:
            box = locator.bounding_box()
            if box:
                target_x = box["x"] + box["width"] * random.uniform(0.3, 0.7)
                target_y = box["y"] + box["height"] * random.uniform(0.3, 0.7)
                steps = random.randint(12, 25)
                page.mouse.move(target_x, target_y, steps=steps)
                time.sleep(random.uniform(0.1, 0.25))
                page.mouse.click(target_x, target_y)
                return True
        except Exception:
            pass
        locator.click()
        return False

    def safe_insert_prompt(self, page: Page, full_prompt: str) -> bool:
        """Безопасно вставляет промпт в редактор Gemini Quill без Range/Selection ошибок"""
        try:
            success = page.evaluate("""(text) => {
                const editor = document.querySelector('div.ql-editor, rich-textarea div[contenteditable="true"], div[contenteditable="true"]');
                if (editor) {
                    editor.focus();
                    const range = document.createRange();
                    range.selectNodeContents(editor);
                    range.collapse(false);
                    const sel = window.getSelection();
                    if (sel) {
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertText', false, text);
                    editor.dispatchEvent(new Event('input', { bubbles: true }));
                    editor.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                }
                return false;
            }""", full_prompt)
            if success:
                time.sleep(0.4)
                return True
        except Exception:
            pass

        try:
            editor = page.locator("div.ql-editor, rich-textarea div[contenteditable='true'], div[contenteditable='true']").first
            self.human_mouse_move_and_click(page, editor)
            time.sleep(0.2)
            page.keyboard.press("Control+A")
            time.sleep(0.1)
            page.keyboard.insert_text(full_prompt)
            time.sleep(0.4)
            return True
        except Exception:
            pass

        return False

    def safe_send_prompt(self, page: Page):
        try:
            send_btn = page.locator("button[aria-label*='Send'], button[aria-label*='Отправить'], button.send-button").first
            if send_btn.is_visible():
                self.human_mouse_move_and_click(page, send_btn)
            else:
                page.keyboard.press("Enter")
        except Exception:
            page.keyboard.press("Enter")

    def open_new_chat(self, page: Page):
        """Гарантированно открывает чистый новый диалог в Gemini для изоляции каждого кадра"""
        opened = False
        new_chat_selectors = [
            "button[aria-label*='New chat']",
            "button[aria-label*='Новый чат']",
            "[data-test-id='new-chat-button']",
            "a[aria-label*='New chat']",
            "a[aria-label*='Новый чат']",
            "div[aria-label*='New chat']",
            "div[aria-label*='Новый чат']"
        ]
        for sel in new_chat_selectors:
            try:
                btn = page.locator(sel).first
                if btn.is_visible():
                    self.human_mouse_move_and_click(page, btn)
                    time.sleep(random.uniform(1.2, 2.0))
                    opened = True
                    break
            except Exception:
                continue

        if not opened:
            try:
                page.goto("https://gemini.google.com/app", wait_until="domcontentloaded")
                time.sleep(random.uniform(1.5, 2.5))
            except Exception:
                pass

        try:
            page.wait_for_selector("div.ql-editor, rich-textarea div[contenteditable='true'], div[contenteditable='true']", timeout=12000)
            time.sleep(0.5)
        except Exception:
            pass

    def capture_image_from_gemini(self, page: Page, out_file: Path, initial_img_count: int = 0, initial_srcs: Optional[list] = None) -> bool:
        """Безопасно и чисто захватывает вновь сгенерированное изображение из Gemini"""
        start_time = time.time()
        initial_set = set(initial_srcs or [])

        # Wait up to 60 seconds for new image to appear and render
        while time.time() - start_time < 60:
            try:
                # 1. Check in JavaScript for newly generated canvas / blob / dataUrl
                img_data = page.evaluate("""(initSrcs) => {
                    const initSet = new Set(initSrcs || []);
                    const selectors = 'button.image-button img, img.image, img.loaded, img[src*="blob:"], img[src*="googleusercontent"], img[alt*="Generated"], model-response img, message-content img, div[data-test-id*="image"] img';
                    const imgs = Array.from(document.querySelectorAll(selectors));

                    for (let i = imgs.length - 1; i >= 0; i--) {
                        const img = imgs[i];
                        const src = img.src || img.currentSrc || '';
                        if (!src) continue;

                        const w = img.naturalWidth || img.width || 0;
                        const h = img.naturalHeight || img.height || 0;

                        // Must be a real rendered illustration, not an avatar/icon
                        if (w > 120 && h > 120) {
                            if (!initSet.has(src) || imgs.length > (initSrcs ? initSrcs.length : 0)) {
                                try {
                                    const canvas = document.createElement('canvas');
                                    canvas.width = w;
                                    canvas.height = h;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0);
                                    const dataUrl = canvas.toDataURL('image/png');
                                    if (dataUrl && dataUrl.length > 2000) {
                                        return { type: 'dataUrl', data: dataUrl };
                                    }
                                } catch(e) {}
                                return { type: 'src', data: src };
                            }
                        }
                    }
                    return null;
                }""", list(initial_set))

                if img_data:
                    data_type = img_data.get('type')
                    data_val = img_data.get('data', '')

                    if data_type == 'dataUrl' and ',' in data_val:
                        b64_pure = data_val.split(',', 1)[1]
                        img_bytes = base64.b64decode(b64_pure)
                        if len(img_bytes) > 3000:
                            with open(out_file, "wb") as f:
                                f.write(img_bytes)
                            self.ensure_pure_png(out_file)
                            return True

                    elif data_type == 'src' and data_val.startswith('data:image'):
                        b64_pure = data_val.split(',', 1)[1]
                        img_bytes = base64.b64decode(b64_pure)
                        if len(img_bytes) > 3000:
                            with open(out_file, "wb") as f:
                                f.write(img_bytes)
                            self.ensure_pure_png(out_file)
                            return True

                    elif data_type == 'src' and data_val.startswith('http'):
                        resp = requests.get(data_val, timeout=10)
                        if resp.status_code == 200 and len(resp.content) > 3000:
                            with open(out_file, "wb") as f:
                                f.write(resp.content)
                            self.ensure_pure_png(out_file)
                            return True

                # 2. Fallback: Check locator screenshot
                img_locators = page.locator("button.image-button img, img.image, img.loaded, img[src*='blob:'], img[src*='googleusercontent'], model-response img").all()
                if len(img_locators) > initial_img_count or (initial_img_count == 0 and len(img_locators) > 0):
                    target_img = img_locators[-1]
                    if target_img.is_visible():
                        box = target_img.bounding_box()
                        if box and box["width"] > 100 and box["height"] > 100:
                            target_img.screenshot(path=str(out_file))
                            if out_file.exists() and out_file.stat().st_size > 3000:
                                self.ensure_pure_png(out_file)
                                return True
            except Exception:
                pass
            time.sleep(1.5)

        return False

    def cleanup_stale_profile(self):
        """Быстро удаляет блокировки профиля Chrome перед запуском"""
        lock_names = ["SingletonLock", "SingletonCookie", "SingletonSocket"]
        for lock_name in lock_names:
            lock_path = self.profile_dir / lock_name
            if lock_path.exists():
                try:
                    lock_path.unlink(missing_ok=True)
                except Exception:
                    pass

    def generate_raw_image(self, prompt: str, out_file: Path) -> bool:
        """Генерирует изображение по чистому промпту (без стилей проекта) и сохраняет по указанному пути"""
        out_file.parent.mkdir(parents=True, exist_ok=True)
        self.cleanup_stale_profile()

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.profile_dir),
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
            self.stealth.apply_stealth_sync(page)
            
            page.goto("https://gemini.google.com/app")
            time.sleep(random.uniform(2.5, 3.5))

            self.open_new_chat(page)

            initial_srcs = page.evaluate("() => Array.from(document.querySelectorAll('img')).map(i => i.src || i.currentSrc || '').filter(Boolean)")
            initial_count = len(page.locator("button.image-button img, img.image, img.loaded, img[src*='blob:'], img[src*='googleusercontent']").all())

            self.safe_insert_prompt(page, prompt)
            self.safe_send_prompt(page)

            img_saved = self.capture_image_from_gemini(page, out_file, initial_img_count=initial_count, initial_srcs=initial_srcs)
            context.close()
            
        return img_saved

    def generate_single_image(self, project_id: str, scene_id: int, custom_prompt: Optional[str] = None, image_id: Optional[str] = None, aspect_ratio: Optional[str] = None) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene:
            raise ValueError(f"Сцена {scene_id} не найдена в проекте {project_id}")

        proj_aspect_ratio = aspect_ratio or proj.settings.get("aspect_ratio", "16:9")

        from app.domain.models import SceneImage, ImageVariant
        if not scene.images:
            scene.images = [SceneImage(
                id="img_1",
                image_file=scene.image_file,
                prompt=scene.image_prompt or scene.desc or scene.text,
                start_time=0.0,
                duration=scene.audio_duration,
                status=scene.image_status or "pending"
            )]

        target_img = None
        if image_id and scene.images:
            target_img = next((img for img in scene.images if img.id == image_id), None)
        if not target_img and scene.images:
            target_img = scene.images[0]

        prompt_text = custom_prompt or (target_img.prompt if target_img else scene.image_prompt) or scene.desc or scene.text
        if not prompt_text.strip():
            raise ValueError("Промпт не может быть пустым")
            
        safe_prompt = sanitize_prompt(prompt_text)
        proj_dir = project_service.get_project_dir(project_id)
        
        # Calculate unique versioned target filename
        ts = int(time.time())
        img_label = target_img.id if target_img else (image_id or "img_1")
        img_rel = f"shots/{scene.shot_id}_{img_label}_{ts}.png"

        out_file = proj_dir / img_rel
        out_file.parent.mkdir(parents=True, exist_ok=True)

        if target_img:
            target_img.status = "generating"
            target_img.prompt = safe_prompt
        scene.image_status = "generating"
        project_service.save_project(proj)

        image_style = (target_img.style if target_img and target_img.style else None) or (scene.style if scene and scene.style else None) or proj.settings.get("style_preset", "storytime_2d")
        style_header = get_gemini_style_header(image_style, proj_aspect_ratio)
        full_prompt = f"{style_header} Visual scene content: {safe_prompt}"
        self.cleanup_stale_profile()

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(self.profile_dir),
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
            self.stealth.apply_stealth_sync(page)
            
            page.goto("https://gemini.google.com/app")
            time.sleep(random.uniform(2.5, 3.5))

            # Open clean new chat
            self.open_new_chat(page)

            # Record existing images before inserting prompt
            initial_srcs = page.evaluate("() => Array.from(document.querySelectorAll('img')).map(i => i.src || i.currentSrc || '').filter(Boolean)")
            initial_count = len(page.locator("button.image-button img, img.image, img.loaded, img[src*='blob:'], img[src*='googleusercontent']").all())

            self.safe_insert_prompt(page, full_prompt)
            self.safe_send_prompt(page)

            # Wait and capture the NEW image
            img_saved = self.capture_image_from_gemini(page, out_file, initial_img_count=initial_count, initial_srcs=initial_srcs)
            context.close()

        # Reload project to ensure clean state
        proj = project_service.get_project(project_id)
        scene = next((s for s in proj.scenes if s.id == scene_id), None)
        if not scene.images:
            scene.images = [SceneImage(
                id="img_1",
                image_file=scene.image_file,
                prompt=safe_prompt,
                start_time=0.0,
                duration=scene.audio_duration,
                status="pending"
            )]
        target_img = next((img for img in scene.images if img.id == (image_id or "img_1")), scene.images[0])

        if img_saved and out_file.exists() and out_file.stat().st_size > 3000:
            from datetime import datetime
            now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # 1. Preserve existing active file in variants
            if target_img.image_file and (proj_dir / target_img.image_file).exists() and target_img.image_file != img_rel:
                if not any(v.file == target_img.image_file for v in target_img.variants):
                    target_img.variants.append(ImageVariant(
                        id=f"v_{Path(target_img.image_file).stem}",
                        file=target_img.image_file,
                        prompt=target_img.prompt,
                        created_at=now_iso
                    ))

            # 2. Add new variant
            if not any(v.file == img_rel for v in target_img.variants):
                target_img.variants.append(ImageVariant(
                    id=f"v_{ts}",
                    file=img_rel,
                    prompt=safe_prompt,
                    created_at=now_iso
                ))

            # 3. Update active file
            target_img.image_file = img_rel
            target_img.status = "ready"
            target_img.prompt = safe_prompt

            if scene.images and target_img.id == scene.images[0].id:
                scene.image_file = img_rel
                scene.image_status = "ready"

            project_service.save_project(proj)
            return {"success": True, "scene_id": scene_id, "image_id": target_img.id, "file": img_rel}
        else:
            if target_img:
                target_img.status = "error"
            scene.image_status = "error"
            project_service.save_project(proj)
            raise RuntimeError(f"Не удалось захватить чистое изображение для сцены {scene_id} в Gemini Web")

    def get_batch_status(self, project_id: str) -> Dict[str, Any]:
        return self.batch_status.get(project_id, {"is_running": False, "current": 0, "total": 0, "label": "", "generated": 0})

    def stop_batch(self, project_id: str):
        self._stop_requested.add(project_id)
        if project_id in self.batch_status:
            self.batch_status[project_id]["is_running"] = False

    def start_batch_images_in_background(self, project_id: str) -> Dict[str, Any]:
        if self.batch_status.get(project_id, {}).get("is_running", False):
            return {"status": "already_running", "details": self.batch_status[project_id]}

        self._stop_requested.discard(project_id)
        import threading
        thread = threading.Thread(target=self._run_batch_worker, args=(project_id,), daemon=True)
        thread.start()
        return {"status": "started", "message": "Пакетная генерация запущена в фоновом режиме"}

    def _run_batch_worker(self, project_id: str):
        try:
            proj = project_service.get_project(project_id)
            proj_dir = project_service.get_project_dir(project_id)

            items_to_gen = []
            for s in proj.scenes:
                if s.images:
                    for img in s.images:
                        img_rel = img.image_file or f"shots/{s.shot_id}_{img.id}.png"
                        out_file = proj_dir / img_rel
                        if not out_file.exists() or out_file.stat().st_size < 3000:
                            items_to_gen.append((s, img, img_rel))
                else:
                    img_rel = s.image_file or f"shots/{s.shot_id}.png"
                    out_file = proj_dir / img_rel
                    if not out_file.exists() or out_file.stat().st_size < 3000:
                        items_to_gen.append((s, None, img_rel))

            if not items_to_gen:
                self.batch_status[project_id] = {"is_running": False, "current": 0, "total": 0, "label": "Все кадры готовы", "generated": 0}
                return

            self.batch_status[project_id] = {
                "is_running": True,
                "current": 0,
                "total": len(items_to_gen),
                "label": "Запуск браузера Gemini...",
                "generated": 0
            }

            print(f"\n[START] Фоновая пакетная генерация {len(items_to_gen)} изображений...")
            self.cleanup_stale_profile()

            with sync_playwright() as p:
                context = p.chromium.launch_persistent_context(
                    user_data_dir=str(self.profile_dir),
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
                self.stealth.apply_stealth_sync(page)
                page.goto("https://gemini.google.com/app")
                time.sleep(random.uniform(3.0, 5.0))

                generated_in_batch = 0

                for idx, (s, img_obj, img_rel) in enumerate(items_to_gen, 1):
                    if project_id in self._stop_requested:
                        print(f"[STOP] Пакетная генерация остановлена пользователем на кадре {idx}")
                        break

                    if generated_in_batch > 0 and generated_in_batch % 15 == 0:
                        break_dur = random.randint(40, 55)
                        self.batch_status[project_id]["label"] = f"Перерыв анти-спам ({break_dur} сек)..."
                        time.sleep(break_dur)

                    # Открываем новый чистый чат для каждого кадра
                    self.open_new_chat(page)

                    # Record existing images before inserting prompt
                    initial_srcs = page.evaluate("() => Array.from(document.querySelectorAll('img')).map(i => i.src || i.currentSrc || '').filter(Boolean)")
                    initial_count = len(page.locator("button.image-button img, img.image, img.loaded, img[src*='blob:'], img[src*='googleusercontent']").all())

                    out_file = proj_dir / img_rel
                    out_file.parent.mkdir(parents=True, exist_ok=True)
                    
                    prompt_text = (img_obj.prompt if img_obj else s.image_prompt) or s.desc or s.text
                    safe_prompt = sanitize_prompt(prompt_text)
                    proj_aspect_ratio = proj.settings.get("aspect_ratio", "16:9")
                    image_style = (img_obj.style if img_obj and img_obj.style else None) or (s.style if s and s.style else None) or proj.settings.get("style_preset", "storytime_2d")
                    style_header = get_gemini_style_header(image_style, proj_aspect_ratio)
                    full_prompt = f"{style_header} Visual scene content: {safe_prompt}"

                    label = f"{s.shot_id} ({img_obj.id})" if img_obj else s.shot_id
                    self.batch_status[project_id] = {
                        "is_running": True,
                        "current": idx,
                        "total": len(items_to_gen),
                        "label": f"Генерация {label} ({idx}/{len(items_to_gen)})",
                        "generated": generated_in_batch
                    }
                    print(f"[{idx}/{len(items_to_gen)}] [GEN] {label}: {safe_prompt[:50]}...")

                    try:
                        self.safe_insert_prompt(page, full_prompt)
                        self.safe_send_prompt(page)

                        # Чистый захват через DOM Canvas / Blob
                        img_saved = self.capture_image_from_gemini(page, out_file, initial_img_count=initial_count, initial_srcs=initial_srcs)

                        fresh_proj = project_service.get_project(project_id)
                        fresh_scene = next((sc for sc in fresh_proj.scenes if sc.id == s.id), None)
                        if fresh_scene:
                            if img_saved and out_file.exists() and out_file.stat().st_size > 3000:
                                from datetime import datetime
                                from app.domain.models import ImageVariant
                                now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                                if img_obj and fresh_scene.images:
                                    fresh_img = next((im for im in fresh_scene.images if im.id == img_obj.id), None)
                                    if fresh_img:
                                        if fresh_img.image_file and (proj_dir / fresh_img.image_file).exists() and fresh_img.image_file != img_rel:
                                            if not any(v.file == fresh_img.image_file for v in fresh_img.variants):
                                                fresh_img.variants.append(ImageVariant(
                                                    id=f"v_{Path(fresh_img.image_file).stem}",
                                                    file=fresh_img.image_file,
                                                    prompt=fresh_img.prompt,
                                                    created_at=now_iso
                                                ))
                                        if not any(v.file == img_rel for v in fresh_img.variants):
                                            fresh_img.variants.append(ImageVariant(
                                                id=f"v_{int(time.time())}",
                                                file=img_rel,
                                                prompt=safe_prompt,
                                                created_at=now_iso
                                            ))
                                        fresh_img.image_file = img_rel
                                        fresh_img.status = "ready"
                                        fresh_img.prompt = safe_prompt

                                if fresh_scene.images and fresh_scene.images[0].id == (img_obj.id if img_obj else "img_1"):
                                    fresh_scene.image_file = img_rel
                                fresh_scene.image_status = "ready"
                                generated_in_batch += 1
                                print(f"   [OK] {label} сохранён ({out_file.stat().st_size // 1024} KB)")
                            else:
                                if img_obj and fresh_scene.images:
                                    fresh_img = next((im for im in fresh_scene.images if im.id == img_obj.id), None)
                                    if fresh_img:
                                        fresh_img.status = "error"
                                print(f"   [!] Ошибка захвата {label}")
                            project_service.save_project(fresh_proj)
                    except Exception as err:
                        print(f"   [ERROR] Ошибка на кадре {label}: {err}")

                    time.sleep(random.uniform(3.0, 5.0))

                context.close()

            print(f"\n[FINISHED] Готово: {generated_in_batch}/{len(items_to_gen)}")
            self.batch_status[project_id] = {
                "is_running": False,
                "current": len(items_to_gen),
                "total": len(items_to_gen),
                "label": "Генерация завершена",
                "generated": generated_in_batch
            }
        except Exception as e:
            print(f"[FATAL] Сбой воркера пакетной генерации: {e}")
            self.batch_status[project_id] = {
                "is_running": False,
                "current": 0,
                "total": 0,
                "label": f"Ошибка: {e}",
                "generated": 0
            }

    def generate_all_images(self, project_id: str) -> Dict[str, Any]:
        return self.start_batch_images_in_background(project_id)

gemini_bot = GeminiBot()
