import os
import json
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional
from app.services.project_service import project_service
from app.services.whisper_service import whisper_service
from app.services.tts_service import tts_service

class VideoService:
    @staticmethod
    def get_audio_duration(file_path: Path) -> float:
        return tts_service.get_audio_duration(file_path)

    def assemble_master_audio(self, project_id: str) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        audio_dir = proj_dir / "audio"

        # Breath pause (0.12s)
        pause_file = audio_dir / "breath_pause.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
            "-t", "0.12", "-q:a", "9", "-acodec", "libmp3lame", str(pause_file)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pause_dur = 0.12

        if not proj.scenes:
            timeline_file = proj_dir / "timeline.json"
            timeline_file.write_text("[]", encoding="utf-8")
            return {"master_audio": "", "timeline_file": str(timeline_file), "total_duration": 0.0, "scenes_count": 0}

        concat_txt = audio_dir / "concat_list.txt"
        current_time = 0.0
        timeline = []

        with open(concat_txt, "w", encoding="utf-8") as f:
            for s in proj.scenes:
                scene_audio = proj_dir / (s.audio_file or f"audio/voice_{s.id:02d}.mp3")
                if not scene_audio.exists():
                    # Generate silence placeholder
                    subprocess.run([
                        "ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                        "-t", "3.0", "-q:a", "9", "-acodec", "libmp3lame", str(scene_audio)
                    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                dur = self.get_audio_duration(scene_audio)
                total_dur = dur + pause_dur
                start_t = current_time
                end_t = current_time + total_dur

                # Extract all visual cuts for this scene
                images_list = s.images if s.images else []
                if not images_list:
                    images_list = [{
                        "id": "img_1",
                        "image_file": s.image_file or f"shots/{s.shot_id}.png",
                        "prompt": s.image_prompt,
                        "start_time": 0.0
                    }]

                timeline.append({
                    "id": s.id,
                    "shot_id": s.shot_id,
                    "images": [
                        {
                            "id": img.id if hasattr(img, "id") else img.get("id", "img_1"),
                            "image_file": img.image_file if hasattr(img, "image_file") else img.get("image_file"),
                            "start_time": img.start_time if hasattr(img, "start_time") else img.get("start_time", 0.0),
                        }
                        for img in images_list
                    ],
                    "start_time": round(start_t, 3),
                    "end_time": round(end_t, 3),
                    "duration": round(total_dur, 3),
                    "voice_duration": round(dur, 3),
                    "text": s.text,
                    "desc": s.desc
                })

                f.write(f"file '{str(scene_audio).replace('\\', '/')}'\n")
                f.write(f"file '{str(pause_file).replace('\\', '/')}'\n")
                current_time = end_t

        master_audio = proj_dir / "audio" / "master_voiceover.mp3"
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_txt), "-c", "copy", str(master_audio)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        timeline_file = proj_dir / "timeline.json"
        with open(timeline_file, "w", encoding="utf-8") as f:
            json.dump(timeline, f, indent=2, ensure_ascii=False)

        total_dur = self.get_audio_duration(master_audio)
        return {
            "master_audio": str(master_audio),
            "timeline_file": str(timeline_file),
            "total_duration": total_dur,
            "scenes_count": len(timeline)
        }

    @staticmethod
    def build_segment_filter(motion_effect: str, segment_index: int, sub_dur: float, fps: int = 30, aspect_ratio: str = "16:9") -> str:
        frames = max(2, int(sub_dur * fps))
        is_vertical = (aspect_ratio == "9:16" or aspect_ratio == "vertical")
        w = 1080 if is_vertical else 1920
        h = 1920 if is_vertical else 1080
        w_pan = 1112 if is_vertical else 1978
        h_pan = 1978 if is_vertical else 1112

        # Base scale to target resolution with padding
        base_pad = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=white"

        if motion_effect == "zoom_in":
            # 1. Smooth Subpixel Center Zoom-In (100% -> 106% с обрезкой по центру)
            return f"{base_pad},scale=w='{w}*(1.0+0.06*n/{frames})':h='{h}*(1.0+0.06*n/{frames})':eval=frame,crop={w}:{h}:x='(iw-ow)/2':y='(ih-oh)/2',format=yuv420p"

        elif motion_effect == "zoom_out":
            # 2. Smooth Subpixel Center Zoom-Out (106% -> 100% с обрезкой по центру)
            return f"{base_pad},scale=w='{w}*(1.06-0.06*n/{frames})':h='{h}*(1.06-0.06*n/{frames})':eval=frame,crop={w}:{h}:x='(iw-ow)/2':y='(ih-oh)/2',format=yuv420p"

        elif motion_effect == "alternate":
            # 3. Alternate Zoom (кадр 1 = 100%->106%, кадр 2 = 106%->100%)
            if segment_index % 2 == 0:
                return f"{base_pad},scale=w='{w}*(1.0+0.06*n/{frames})':h='{h}*(1.0+0.06*n/{frames})':eval=frame,crop={w}:{h}:x='(iw-ow)/2':y='(ih-oh)/2',format=yuv420p"
            else:
                return f"{base_pad},scale=w='{w}*(1.06-0.06*n/{frames})':h='{h}*(1.06-0.06*n/{frames})':eval=frame,crop={w}:{h}:x='(iw-ow)/2':y='(ih-oh)/2',format=yuv420p"

        elif motion_effect == "snap_punch":
            # 4. Snap Punch-In (Мгновенный скачок 112% и плавный возврат)
            return f"{base_pad},scale=w='{w}*if(lt(n,4),1.0+0.12*(n/4),1.12-0.04*((n-4)/{frames}))':h='{h}*if(lt(n,4),1.0+0.12*(n/4),1.12-0.04*((n-4)/{frames}))':eval=frame,crop={w}:{h}:x='(iw-ow)/2':y='(ih-oh)/2',format=yuv420p"

        elif motion_effect == "whip_pan":
            # 5. Whip Pan / Fast Comic Slide (Хлесткий боковой сдвиг)
            direction = 1 if segment_index % 2 == 0 else -1
            return f"{base_pad},scale=w={w_pan}:h={h_pan},crop={w}:{h}:x='(in_w-out_w)/2+{direction}*if(lt(n,6),(6-n)*20,0)':y='(in_h-out_h)/2',format=yuv420p"

        else:
            # 6. Static (Без движения / жесткий стык)
            return f"{base_pad},format=yuv420p"

    def render_full_video(
        self,
        project_id: str,
        speed: float = 1.2,
        motion_effect: str = "zoom_in",
        aspect_ratio: Optional[str] = None,
        bgm_track: Optional[str] = None,
        bgm_volume: Optional[float] = None
    ) -> Dict[str, Any]:
        import shutil
        proj = project_service.get_project(project_id)
        proj_aspect_ratio = aspect_ratio or proj.settings.get("aspect_ratio", "16:9")
        is_vertical = (proj_aspect_ratio == "9:16" or proj_aspect_ratio == "vertical")

        proj_dir = project_service.get_project_dir(project_id)
        output_dir = proj_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        # 1. Assemble audio & timeline
        timeline_info = self.assemble_master_audio(project_id)
        timeline_file = proj_dir / "timeline.json"
        with open(timeline_file, "r", encoding="utf-8") as f:
            timeline = json.load(f)

        master_audio = proj_dir / "audio" / "master_voiceover.mp3"

        # Check for background music in project settings or arguments
        bgm_settings = proj.settings.get("bgm", {}) if proj.settings else {}
        bgm_track_name = bgm_track or bgm_settings.get("track")
        bgm_file = None
        if bgm_track_name:
            from app.services.bgm_service import bgm_service
            bgm_file = bgm_service.get_track_file(bgm_track_name)

        bgm_vol = bgm_volume if bgm_volume is not None else bgm_settings.get("volume", 0.15)
        raw_dur = self.get_audio_duration(master_audio)

        if bgm_file and bgm_file.exists():
            mixed_audio = output_dir / "temp_mixed_master_audio.mp3"
            fade_start = max(0.0, raw_dur - 1.5)
            cmd_mix = [
                "ffmpeg", "-y",
                "-i", str(master_audio),
                "-stream_loop", "-1",
                "-i", str(bgm_file),
                "-filter_complex",
                f"[1:a]volume={bgm_vol:.2f},afade=t=out:st={fade_start:.2f}:d=1.5[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]",
                "-map", "[aout]",
                "-c:a", "libmp3lame", "-b:a", "192k",
                str(mixed_audio)
            ]
            subprocess.run(cmd_mix, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            active_audio = mixed_audio
        else:
            active_audio = master_audio

        # 2. Render segments with Camera Motion & multi-image support
        segments_dir = proj_dir / "temp_segments"
        if segments_dir.exists():
            shutil.rmtree(segments_dir)
        segments_dir.mkdir(parents=True, exist_ok=True)

        concat_seg_txt = segments_dir / "concat_segments.txt"
        segment_index = 0
        seg_entries = []

        w = 1080 if is_vertical else 1920
        h = 1920 if is_vertical else 1080
        static_vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p"

        for item in timeline:
            scene_total_dur = float(item["duration"])
            imgs = item.get("images", [])
            if not imgs:
                img_rel = item.get("shot_png") or f"shots/{item['shot_id']}.png"
                imgs = [{"image_file": img_rel, "start_time": 0.0}]

            imgs_sorted = sorted(imgs, key=lambda x: x.get("start_time", 0.0))
            for i, img_data in enumerate(imgs_sorted):
                img_rel = img_data.get("image_file") or f"shots/{item['shot_id']}.png"
                img_path = proj_dir / img_rel

                cur_start = float(img_data.get("start_time", 0.0))
                if i + 1 < len(imgs_sorted):
                    next_start = float(imgs_sorted[i + 1].get("start_time", scene_total_dur))
                    sub_dur = max(0.3, next_start - cur_start)
                else:
                    sub_dur = max(0.3, scene_total_dur - cur_start)

                seg_out = segments_dir / f"seg_{segment_index:04d}.mp4"
                is_vid = img_path.exists() and img_path.suffix.lower() in [".mp4", ".webm", ".mov", ".mkv"]

                if is_vid:
                    # Loop or cut video clip to exact sub_dur
                    cmd_seg = [
                        "ffmpeg", "-y",
                        "-stream_loop", "-1",
                        "-t", f"{sub_dur:.3f}",
                        "-i", str(img_path),
                        "-vf", static_vf,
                        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-r", "30",
                        "-an",
                        str(seg_out)
                    ]
                else:
                    if not img_path.exists():
                        img_path.parent.mkdir(parents=True, exist_ok=True)
                        subprocess.run([
                            "ffmpeg", "-y", "-f", "lavfi", "-i", f"color=c=white:s={w}x{h}:d=1",
                            "-frames:v", "1", str(img_path)
                        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

                    # Dynamic camera motion filter with subpixel evaluation
                    vf_motion = self.build_segment_filter(motion_effect, segment_index, sub_dur, fps=30, aspect_ratio=proj_aspect_ratio)
                    cmd_seg = [
                        "ffmpeg", "-y",
                        "-loop", "1",
                        "-t", f"{sub_dur:.3f}",
                        "-i", str(img_path),
                        "-vf", vf_motion,
                        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-r", "30",
                        "-an",
                        str(seg_out)
                    ]

                subprocess.run(cmd_seg, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
                seg_entries.append(f"file '{str(seg_out).replace('\\', '/')}'")
                segment_index += 1

        with open(concat_seg_txt, "w", encoding="utf-8") as f:
            f.write("\n".join(seg_entries) + "\n")

        temp_video_only = segments_dir / "temp_video_only.mp4"
        subprocess.run([
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", str(concat_seg_txt),
            "-c", "copy",
            str(temp_video_only)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        base_video = output_dir / "temp_base_10x.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-i", str(temp_video_only),
            "-i", str(active_audio),
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(base_video)
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        final_video = output_dir / "full_video_1080p.mp4"

        # Apply speedup
        cmd_speed = [
            "ffmpeg", "-y",
            "-i", str(base_video),
            "-filter_complex", f"[0:v]setpts=(1/{speed})*PTS[v];[0:a]atempo={speed}[a]",
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", "30",
            "-c:a", "aac", "-b:a", "192k",
            str(final_video)
        ]
        subprocess.run(cmd_speed, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        if base_video.exists():
            os.remove(base_video)

        dur = self.get_audio_duration(final_video)
        size_mb = final_video.stat().st_size / (1024 * 1024)

        return {
            "success": True,
            "video_path": str(final_video),
            "video_rel": "output/full_video_1080p.mp4",
            "duration": dur,
            "size_mb": round(size_mb, 2),
            "motion_effect": motion_effect,
            "aspect_ratio": proj_aspect_ratio
        }

    def render_shorts_and_tiktoks(self, project_id: str, speed: float = 1.2, motion_effect: str = "zoom_in", aspect_ratio: Optional[str] = None) -> Dict[str, Any]:
        proj = project_service.get_project(project_id)
        proj_aspect_ratio = aspect_ratio or proj.settings.get("aspect_ratio", "16:9")
        is_vertical = (proj_aspect_ratio == "9:16" or proj_aspect_ratio == "vertical")
        w, h = (1080, 1920) if is_vertical else (1920, 1080)

        proj_dir = project_service.get_project_dir(project_id)
        output_dir = proj_dir / "output"
        shorts_dir = output_dir / "shorts"
        tiktoks_dir = output_dir / "tiktoks"
        subtitles_dir = proj_dir / "subtitles"

        shorts_dir.mkdir(parents=True, exist_ok=True)
        tiktoks_dir.mkdir(parents=True, exist_ok=True)
        subtitles_dir.mkdir(parents=True, exist_ok=True)

        for f in shorts_dir.iterdir():
            if f.is_file(): f.unlink()
        for f in tiktoks_dir.iterdir():
            if f.is_file(): f.unlink()

        self.render_full_video(project_id, speed=speed, motion_effect=motion_effect, aspect_ratio=proj_aspect_ratio)
        full_video = output_dir / "full_video_1080p.mp4"
        master_audio = proj_dir / "audio" / "master_voiceover.mp3"
        srt_file = subtitles_dir / "subtitles.srt"
        ass_file = subtitles_dir / "dynamic_subtitles.ass"

        sub_settings = proj.settings.get("subtitles", {}) if proj.settings else {}
        whisper_service.generate_subtitles(master_audio, srt_file, ass_file, speed=speed, subtitle_settings=sub_settings)

        vertical_master = output_dir / "temp_vertical_master_9_16.mp4"
        escaped_ass = str(ass_file).replace("\\", "/").replace(":", r"\:")

        if is_vertical:
            filter_complex = f"[0:v]subtitles='{escaped_ass}'[v]"
        else:
            filter_complex = (
                "[0:v]scale=180:320:force_original_aspect_ratio=increase,crop=180:320,"
                "boxblur=8:3,scale=1080:1920,eq=brightness=-0.25:contrast=0.9[bg];"
                "[0:v]scale=1080:-1[fg];"
                f"[bg][fg]overlay=(W-w)/2:(H-h)/2,subtitles='{escaped_ass}'[v]"
            )

        cmd_vertical = [
            "ffmpeg", "-y", "-i", str(full_video), "-filter_complex", filter_complex,
            "-map", "[v]", "-map", "0:a",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100",
            str(vertical_master)
        ]
        subprocess.run(cmd_vertical, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        def make_bumper_clip(img_name: str, audio_name: str, duration: float, out_path: Path):
            img_p = proj_dir / "output" / img_name
            audio_p = proj_dir / "output" / audio_name
            has_img = img_p.exists() and img_p.stat().st_size > 0
            has_audio = audio_p.exists() and audio_p.stat().st_size > 0
            
            vf_scale = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
            
            args = ["ffmpeg", "-y"]
            if has_img:
                args.extend(["-loop", "1", "-i", str(img_p)])
            else:
                args.extend(["-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:d={duration}"])
                
            if has_audio:
                args.extend(["-i", str(audio_p)])
            else:
                args.extend(["-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={duration}"])
                
            args.extend([
                "-vf", vf_scale, "-t", str(duration),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100",
                str(out_path)
            ])
            subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        shorts_results = []
        chunks_plan = self.get_shorts_plan(project_id, speed)["chunks"]
        
        for chunk in chunks_plan:
            idx = chunk["idx"]
            start_t = chunk["start"]
            dur = chunk["end"] - chunk["start"]
            
            part_name = f"short_part_{idx+1}.mp4"
            out_p = shorts_dir / part_name
            temp_chunk = output_dir / f"temp_chunk_{idx}.mp4"
            
            # Put -ss AFTER -i for perfectly frame and audio accurate seeking, 
            # and re-encode to ensure no keyframe drift or audio sync issues
            subprocess.run([
                "ffmpeg", "-y",
                "-i", str(vertical_master),
                "-ss", f"{start_t:.3f}", "-t", f"{dur:.3f}",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100",
                str(temp_chunk)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
            intro_p = output_dir / f"intro_{idx}.mp4"
            outro_p = output_dir / f"outro_{idx}.mp4"
            pause_ai_p = output_dir / f"pause_ai_{idx}.mp4"  # after intro
            pause_bo_p = output_dir / f"pause_bo_{idx}.mp4"  # before outro
            
            make_bumper_clip(chunk["intro"]["image_file"], chunk["intro"]["audio_file"], 2.0, intro_p)
            make_bumper_clip(chunk["outro"]["image_file"], chunk["outro"]["audio_file"], 2.5, outro_p)

            def _black(dur_s: float, out: Path):
                subprocess.run([
                    "ffmpeg", "-y",
                    "-f", "lavfi", "-i", f"color=c=black:s={w}x{h}:d={dur_s}",
                    "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=stereo:d={dur_s}",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-r", "30", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "44100", "-shortest",
                    str(out)
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

            _black(0.8, pause_ai_p)
            _black(0.8, pause_bo_p)

            
            concat_txt = output_dir / f"concat_part_{idx}.txt"
            with open(concat_txt, "w", encoding="utf-8") as f:
                f.write(f"file '{str(intro_p).replace(chr(92), '/')}'\n")
                f.write(f"file '{str(pause_ai_p).replace(chr(92), '/')}'\n")
                f.write(f"file '{str(temp_chunk).replace(chr(92), '/')}'\n")
                f.write(f"file '{str(pause_bo_p).replace(chr(92), '/')}'\n")
                f.write(f"file '{str(outro_p).replace(chr(92), '/')}'\n")
                
            subprocess.run([
                "ffmpeg", "-y", "-f", "concat", "-safe", "0",
                "-i", str(concat_txt), "-c", "copy", str(out_p)
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
            
            intro_p.unlink(missing_ok=True)
            pause_ai_p.unlink(missing_ok=True)
            pause_bo_p.unlink(missing_ok=True)
            outro_p.unlink(missing_ok=True)
            temp_chunk.unlink(missing_ok=True)
            concat_txt.unlink(missing_ok=True)
            
            final_dur = dur + 2.0 + 0.8 + 0.8 + 2.5
            shorts_results.append({
                "name": part_name,
                "duration": round(final_dur, 1),
                "rel_path": f"output/shorts/{part_name}",
                "size_mb": round(out_p.stat().st_size / (1024 * 1024), 2)
            })

        if vertical_master.exists():
            os.remove(vertical_master)

        return {
            "shorts": shorts_results,
            "tiktoks": shorts_results,
            "subtitles_srt": "subtitles/subtitles.srt",
            "subtitles_ass": "subtitles/dynamic_subtitles.ass"
        }

    def save_shorts_plan(self, project_id: str, chunks: List[Any], speed: float = 1.0) -> None:
        import json
        from app.services.project_service import project_service
        proj_dir = project_service.get_project_dir(project_id)
        plan_file = proj_dir / "shorts_plan.json"
        plan_file.write_text(json.dumps({"speed": speed, "chunks": chunks}, ensure_ascii=False, indent=2), "utf-8")

    def get_shorts_plan(self, project_id: str, speed: float = 1.0, force_recalc: bool = False) -> Dict[str, Any]:
        import json
        from app.services.project_service import project_service
        proj = project_service.get_project(project_id)
        proj_dir = project_service.get_project_dir(project_id)
        
        plan_file = proj_dir / "shorts_plan.json"
        if not force_recalc and plan_file.exists():
            try:
                cached = json.loads(plan_file.read_text("utf-8"))
                # Check if it was generated with the same speed
                if cached.get("speed", 1.0) == speed:
                    return cached
            except:
                pass
        
        timeline_file = proj_dir / "timeline.json"
        if not timeline_file.exists() or force_recalc:
            try:
                self.assemble_master_audio(project_id)
            except Exception as assemble_err:
                print(f"[!] Warning assembling master audio in get_shorts_plan: {assemble_err}")

        timeline = []
        if timeline_file.exists():
            try:
                with open(timeline_file, "r", encoding="utf-8") as f:
                    timeline = json.load(f)
            except Exception as json_err:
                print(f"[!] Error reading timeline.json: {json_err}")

        if not timeline and proj.scenes:
            # Fallback: calculate timeline from scenes directly
            cur_t = 0.0
            for idx, s in enumerate(proj.scenes, 1):
                dur = s.audio_duration or 3.0
                timeline.append({
                    "scene_id": s.id,
                    "shot_id": s.shot_id or f"shot_{idx:02d}",
                    "text": s.text or "",
                    "start_time": round(cur_t, 3),
                    "end_time": round(cur_t + dur, 3),
                    "duration": round(dur, 3)
                })
                cur_t += dur + 0.35

        if not timeline:
            return {"speed": speed, "chunks": []}

        # Splitting into chunks targeting ~40 seconds each, cutting strictly on scene boundaries
        chunks = []
        current_chunk = {"start": 0.0, "end": 0.0, "scenes": [], "scene_indexes": []}
        
        for idx_scene, scene in enumerate(timeline):
            scene_start = float(scene["start_time"]) / speed
            scene_end = float(scene["end_time"]) / speed
            
            if current_chunk["end"] == 0.0:
                current_chunk["start"] = scene_start
                current_chunk["end"] = scene_end
                current_chunk["scenes"].append(scene.get("text", ""))
                current_chunk["scene_indexes"].append(idx_scene + 1)
            else:
                current_dur = current_chunk["end"] - current_chunk["start"]
                dur_if_added = scene_end - current_chunk["start"]
                
                # Split only when adding pushes past ~50-55s and chunk has at least ~30s, or dur >= 33s and adding exceeds 45s
                if (dur_if_added > 55.0 and current_dur >= 25.0) or (current_dur >= 33.0 and dur_if_added > 45.0):
                    chunks.append(current_chunk)
                    current_chunk = {"start": scene_start, "end": scene_end, "scenes": [scene.get("text", "")], "scene_indexes": [idx_scene + 1]}
                else:
                    current_chunk["end"] = scene_end
                    current_chunk["scenes"].append(scene.get("text", ""))
                    current_chunk["scene_indexes"].append(idx_scene + 1)
                    
        if current_chunk["end"] > current_chunk["start"]:
            chunks.append(current_chunk)

        project_title = proj.title or "My Movie"
        eng_title = proj.settings.get("eng_title")
        if not eng_title:
            eng_title = "".join([c if ord(c) < 128 else "" for c in project_title]).strip()
            if not eng_title:
                eng_title = proj.id.replace("-", " ").title()

        bumpers_cfg = proj.settings.get("shorts_bumpers", {})
        intro_tmpl = bumpers_cfg.get("intro_template", "")
        outro_tmpl = bumpers_cfg.get("outro_template", "")
        
        passport_chars = proj.settings.get("movie_passport", {}).get("characters", "")
        main_char_desc = "stick figure main character"
        if passport_chars:
            first_line = passport_chars.strip().split("\n")[0]
            main_char_desc = first_line.replace("-", "").strip() or main_char_desc
            
        style_preset = proj.settings.get("style_preset", "storytime_2d")

        plan_chunks = []
        for idx, chunk in enumerate(chunks):
            dur = chunk["end"] - chunk["start"]
            if dur < 2.0: continue
            
            part_num = idx + 1
            next_part_num = idx + 2
            is_last = (idx == len(chunks) - 1)

            # English text strictly without [whispering]
            intro_overlay = f"{eng_title.upper()} - PART {part_num}"
            intro_voice = f"{eng_title}, Part {part_num}."

            outro_overlay = "THE END - SUBSCRIBE!" if is_last else f"TO BE CONTINUED - PART {next_part_num}"
            outro_voice = "The end. Subscribe for more movie recaps!" if is_last else f"End of Part {part_num}. To be continued! Subscribe for Part {next_part_num}!"

            # Intro prompt
            if intro_tmpl:
                intro_prompt = (intro_tmpl
                    .replace("{PART_NUM}", str(part_num))
                    .replace("{NEXT_PART_NUM}", str(next_part_num))
                    .replace("{Movie Title}", eng_title)
                    .replace("{Movie Name}", eng_title))
            else:
                intro_prompt = f"[Style: {style_preset}] A vertical 9:16 title card for '{eng_title}'. In the center, {main_char_desc} looking directly at the camera with an expressive curious pose. At the top, bold stylized title text '{eng_title}'. In the center, comic badge 'Part {part_num}: Short Story'. Dramatic vertical mobile composition, vertical framing, 9:16"

            # Outro prompt
            if outro_tmpl:
                outro_prompt = (outro_tmpl
                    .replace("{PART_NUM}", str(part_num))
                    .replace("{NEXT_PART_NUM}", str(next_part_num))
                    .replace("{Movie Title}", eng_title)
                    .replace("{Movie Name}", eng_title))
                if is_last:
                    outro_prompt = outro_prompt.replace("To be continued", "The End").replace(f"Part {next_part_num}", "the next recap")
            else:
                ending_text = "The End! Subscribe for more!" if is_last else f"End of Part {part_num}! Subscribe for Part {next_part_num}!"
                outro_prompt = f"[Style: {style_preset}] A vertical 9:16 ending cliffhanger card for '{eng_title}'. In the center, {main_char_desc} looking completely shocked with jaw dropped and comic exclamation marks. Prominent bold comic text '{ending_text}'. Dark moody background, vertical framing, 9:16"

            plan_chunks.append({
                "idx": idx,
                "start": chunk["start"],
                "end": chunk["end"],
                "duration": dur,
                "included_scenes": chunk["scene_indexes"],
                "intro": {
                    "image_prompt": intro_prompt,
                    "voice_text": intro_voice,
                    "overlay_text": intro_overlay,
                    "image_file": f"intro_{idx}.png",
                    "audio_file": f"intro_{idx}.wav"
                },
                "outro": {
                    "image_prompt": outro_prompt,
                    "voice_text": outro_voice,
                    "overlay_text": outro_overlay,
                    "image_file": f"outro_{idx}.png",
                    "audio_file": f"outro_{idx}.wav"
                }
            })

        plan_data = {"speed": speed, "chunks": plan_chunks}
        self.save_shorts_plan(project_id, plan_chunks, speed)
        return plan_data

    def generate_bumper_image(self, project_id: str, prompt: str, output_name: str, is_vertical: bool = True) -> Dict[str, str]:
        from app.services.gemini_bot import GeminiBot, get_gemini_style_header
        from app.core.sanitizer import sanitize_prompt
        from app.services.script_parser import detect_image_style
        
        gemini = GeminiBot()
        proj_dir = project_service.get_project_dir(project_id)
        out_dir = proj_dir / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / output_name
        
        aspect_ratio = "9:16" if is_vertical else "16:9"
        clean_prompt, img_style = detect_image_style(prompt)
        style_header = get_gemini_style_header(style_key=img_style, aspect_ratio=aspect_ratio)
        safe_prompt = sanitize_prompt(clean_prompt)
        
        ar_tag = "9:16" if is_vertical else "16:9"
        gemini_prompt = (
            f"{style_header}\n\n"
            f"TASK: Generate a single standalone viral {ar_tag} vertical bumper card (intro/outro title card for mobile video).\n"
            f"COMPOSITION: Vertical 9:16 framing, mobile wallpaper orientation, centered action.\n"
            f"CARD DETAILS: {safe_prompt}\n"
            f"--ar {ar_tag}"
        )
        print(f"\n[*] Gemini Bumper Prompt ({ar_tag}): {gemini_prompt}")
        gemini.generate_raw_image(gemini_prompt, out_path)
        return {"url": f"output/{output_name}"}

    def generate_bumper_audio(self, project_id: str, text: str, output_name: str) -> Dict[str, str]:
        import re
        from app.services.tts_service import tts_service
        proj_dir = project_service.get_project_dir(project_id)
        out_dir = proj_dir / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / output_name
        
        clean_text = re.sub(r"\[(?:whispering|whisper)\]", "", text, flags=re.IGNORECASE).strip()
        whisper_ref = r"C:\Users\buryy\Downloads\whisper_looped.wav"
        ref = whisper_ref if Path(whisper_ref).exists() else None
        tts_service.generate_speech_local(clean_text, out_path, voice_ref_path=ref)
        return {"url": f"output/{output_name}"}

video_service = VideoService()
