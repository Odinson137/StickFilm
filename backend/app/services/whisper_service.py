import os
from pathlib import Path
from typing import Dict, Any, List, Optional
import whisper

class WhisperService:
    def __init__(self):
        self._model = None

    def get_model(self):
        if self._model is None:
            self._model = whisper.load_model("base")
        return self._model

    @staticmethod
    def format_ass_time(seconds: float) -> str:
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        centi = int(round((seconds - int(seconds)) * 100))
        if centi >= 100:
            secs += 1
            centi = 0
        return f"{hrs}:{mins:02d}:{secs:02d}.{centi:02d}"

    @staticmethod
    def format_srt_time(seconds: float) -> str:
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        milli = int(round((seconds - int(seconds)) * 1000))
        if milli >= 1000:
            secs += 1
            milli = 0
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{milli:03d}"

    def transcribe_single_audio_words(self, audio_file: Path) -> List[Dict[str, Any]]:
        """Извлекает пословные таймкоды для одного аудиофайла сцены"""
        if not audio_file.exists():
            return []

        model = self.get_model()
        result = model.transcribe(str(audio_file), language="en", word_timestamps=True)
        
        words = []
        for seg in result.get("segments", []):
            for w in seg.get("words", []):
                clean_word = w.get("word", "").strip()
                if clean_word:
                    words.append({
                        "word": clean_word,
                        "start": round(float(w.get("start", 0.0)), 2),
                        "end": round(float(w.get("end", 0.0)), 2)
                    })
        return words

    @staticmethod
    def hex_to_ass_color(hex_str: str, alpha: str = "00") -> str:
        """Конвертирует #RRGGBB в формат ASS &HAABBGGRR&"""
        if not hex_str:
            return f"&H{alpha}00E6FF&"
        clean = hex_str.strip().lstrip("#")
        if clean.startswith("&H") or clean.startswith("&h"):
            return clean
        if len(clean) == 6:
            r, g, b = clean[0:2], clean[2:4], clean[4:6]
            return f"&H{alpha}{b}{g}{r}&"
        return f"&H{alpha}00E6FF&"

    def generate_subtitles(
        self,
        audio_file: Path,
        output_srt: Path,
        output_ass: Path,
        speed: float = 1.0,
        subtitle_settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not audio_file.exists():
            raise FileNotFoundError(f"Audio file '{audio_file}' not found")

        model = self.get_model()
        result = model.transcribe(str(audio_file), language="en", word_timestamps=True)

        settings = subtitle_settings or {}
        font_name = settings.get("font", "Impact")
        font_size = int(settings.get("font_size", 68))
        raw_highlight = settings.get("highlight_color", "#00E6FF")
        raw_primary = settings.get("primary_color", "#FFFFFF")
        animation_mode = settings.get("animation", "karaoke")

        ass_highlight = self.hex_to_ass_color(raw_highlight)
        ass_primary = self.hex_to_ass_color(raw_primary)

        # 1. Build SRT file
        with open(output_srt, "w", encoding="utf-8") as srt_f:
            for idx, seg in enumerate(result.get("segments", []), 1):
                start_s = seg["start"] / speed
                end_s = seg["end"] / speed
                text = seg["text"].strip()
                srt_f.write(f"{idx}\n")
                srt_f.write(f"{self.format_srt_time(start_s)} --> {self.format_srt_time(end_s)}\n")
                srt_f.write(f"{text}\n\n")

        # 2. Build Dynamic Animated ASS file (TikTok / Reels Style)
        all_words = []
        for segment in result.get("segments", []):
            for w in segment.get("words", []):
                w_text = w.get("word", "").strip()
                if not w_text:
                    continue
                start = w.get("start") / speed
                end = w.get("end") / speed
                all_words.append({
                    "word": w_text.upper(),
                    "start": start,
                    "end": max(start + 0.08, end)
                })

        ass_events = []
        COLOR_HIGHLIGHT = rf"{{\c{ass_highlight}\t(0,50,\fscx115\fscy115)}}"
        COLOR_NORMAL = rf"{{\c{ass_primary}\fscx100\fscy100}}"

        if animation_mode == "popup":
            # 1-word pop-up style (Alex Hormozi)
            for cur_word in all_words:
                w_start = cur_word["start"]
                w_end = cur_word["end"]
                line_text = rf"{{\c{ass_highlight}\t(0,40,\fscx120\fscy120)}}{cur_word['word']}"
                ass_events.append((w_start, w_end, line_text))
        else:
            # Karaoke 3-4 word phrase style
            chunks = []
            chunk_size = 4
            for i in range(0, len(all_words), chunk_size):
                chunks.append(all_words[i:i + chunk_size])

            for chunk in chunks:
                chunk_start = chunk[0]["start"]
                for cur_idx, cur_word in enumerate(chunk):
                    w_start = cur_word["start"]
                    if cur_idx + 1 < len(chunk):
                        w_end = chunk[cur_idx + 1]["start"]
                    else:
                        w_end = cur_word["end"]

                    w_start = max(chunk_start, w_start)
                    w_end = max(w_start + 0.08, w_end)

                    formatted_words = []
                    for j, w in enumerate(chunk):
                        if j == cur_idx:
                            formatted_words.append(f"{COLOR_HIGHLIGHT}{w['word']}{COLOR_NORMAL}")
                        else:
                            formatted_words.append(f"{COLOR_NORMAL}{w['word']}")

                    line_text = " ".join(formatted_words)
                    ass_events.append((w_start, w_end, line_text))

        ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TikTokStyle,{font_name},{font_size},{ass_primary},{ass_highlight},&H00000000,&H90000000,-1,0,0,0,100,100,2,0,1,5.5,0,2,50,50,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        with open(output_ass, "w", encoding="utf-8") as f:
            f.write(ass_header)
            for start_t, end_t, text in ass_events:
                f.write(f"Dialogue: 0,{self.format_ass_time(start_t)},{self.format_ass_time(end_t)},TikTokStyle,,0,0,0,,{text}\n")

        return {
            "srt_path": str(output_srt),
            "ass_path": str(output_ass),
            "total_words": len(all_words)
        }

whisper_service = WhisperService()

