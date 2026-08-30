from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ImageVariant(BaseModel):
    id: str # e.g. "v_1724398000"
    file: str # Relative path e.g. "shots/shot_01_v1724398000.png"
    prompt: Optional[str] = ""
    created_at: Optional[str] = None

class SceneImage(BaseModel):
    id: str # e.g. "img_1", "img_2"
    image_file: Optional[str] = None # Relative path e.g. "shots/shot_01a.png"
    prompt: str = ""
    style: Optional[str] = "storytime_2d" # "storytime_2d", "paper_cutout", "vintage_comic", "retro_16bit", "rubber_hose_1930s", "sharpie_notebook"
    start_time: float = 0.0 # Time offset in seconds from scene audio start
    duration: Optional[float] = None # Calculated duration before next image or scene end
    word_index: Optional[int] = 0
    selected_text: Optional[str] = ""
    status: str = "pending" # "pending", "generating", "ready", "error"
    variants: List[ImageVariant] = [] # List of previous versions/variants

class SelectVariantRequest(BaseModel):
    image_id: Optional[str] = None
    file: str

class Scene(BaseModel):
    id: int
    shot_id: str # e.g. "shot_01"
    timing: Optional[str] = "" # e.g. "0:00 - 0:04"
    text: str # Voiceover line
    desc: Optional[str] = "" # Visual description
    image_prompt: Optional[str] = "" # AI Prompt for default frame
    style: Optional[str] = "storytime_2d" # Default scene style
    image_file: Optional[str] = None # Relative filename e.g. "shots/shot_01.png"
    audio_file: Optional[str] = None # Relative filename e.g. "audio/voice_01.mp3"
    audio_duration: Optional[float] = 0.0
    image_status: str = "pending" # "pending", "generating", "ready", "error"
    audio_status: str = "pending" # "pending", "generating", "ready", "error"
    # Multi-image collection & word-level timestamps
    images: List[SceneImage] = []
    words: List[Dict[str, Any]] = [] # [{word: "...", start: 0.1, end: 0.4}, ...]

class Project(BaseModel):
    id: str # slug e.g. "spider-man-2"
    title: str # "Spider-Man 2 Recap"
    created_at: str
    updated_at: str
    scenes: List[Scene] = []
    settings: Dict[str, Any] = {
        "speed": 1.2,
        "voice_id": "",
        "voice_name": "Chatterbox Local",
        "model_id": "chatterbox_turbo",
        "resolution": "1080p",
        "aspect_ratio": "16:9", # "16:9" or "9:16"
        "style_preset": "storytime_2d",
        "subtitles": {
            "font": "Impact",
            "highlight_color": "#00E6FF",
            "font_size": 68,
            "animation": "karaoke"
        },
        "bgm": {
            "track": "",
            "volume": 0.15,
            "fade_out": True
        },
        "movie_passport": {
            "title": "",
            "genre": "thriller",
            "characters": "",
            "lighting": ""
        }
    }

class ProjectCreateRequest(BaseModel):
    title: str
    aspect_ratio: Optional[str] = "16:9"

class ScriptParseRequest(BaseModel):
    script_text: str

class ScriptParseResponse(BaseModel):
    scenes: List[Scene]
    settings: Optional[Dict[str, Any]] = None
    thumbnails: Optional[List[Dict[str, str]]] = None

class GenerateAudioSingleRequest(BaseModel):
    scene_id: int
    text: Optional[str] = None
    voice_id: Optional[str] = None

class GenerateImageSingleRequest(BaseModel):
    scene_id: int
    image_id: Optional[str] = None # If provided, generates specific SceneImage
    prompt: Optional[str] = None
    style: Optional[str] = None # Individual style for this generation
    aspect_ratio: Optional[str] = None # "16:9" or "9:16"

class AddSceneImageRequest(BaseModel):
    scene_id: int
    word_index: int
    selected_text: str
    start_time: float
    prompt: str
    style: Optional[str] = "storytime_2d"

class DeleteSceneImageRequest(BaseModel):
    scene_id: int
    image_id: str

class RenderVideoRequest(BaseModel):
    speed: Optional[float] = 1.2
    add_subtitles: Optional[bool] = False
    language: Optional[str] = "en"
    motion_effect: Optional[str] = "zoom_in" # "zoom_in", "alternate", "snap_punch", "whip_pan", "none"
    aspect_ratio: Optional[str] = None # "16:9" or "9:16"
    bgm_track: Optional[str] = None
    bgm_volume: Optional[float] = 0.15
    subtitle_font: Optional[str] = None
    subtitle_highlight_color: Optional[str] = None
    subtitle_animation: Optional[str] = None

class TokenAddRequest(BaseModel):
    key: str

class ThumbnailOption(BaseModel):
    id: str # "thumb_1", "thumb_2", "thumb_3"
    title: str # e.g. "Option A: Action & Chaos"
    prompt: str
    image_file: Optional[str] = None
    status: str = "pending" # "pending", "generating", "ready", "error"

class ProjectThumbnails(BaseModel):
    project_id: str
    thumbnails: List[ThumbnailOption] = []

class ShortBumperData(BaseModel):
    image_file: str
    audio_file: str

class ShortChunkData(BaseModel):
    start: float
    end: float
    intro: ShortBumperData
    outro: ShortBumperData

class RenderShortsRequest(RenderVideoRequest):
    chunks: List[ShortChunkData]

