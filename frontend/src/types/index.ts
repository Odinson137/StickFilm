export type StylePresetId = 
  | 'storytime_2d'
  | 'paper_cutout'
  | 'vintage_comic'
  | 'retro_16bit'
  | 'rubber_hose_1930s'
  | 'sharpie_notebook';

export interface StyleOption {
  id: StylePresetId;
  name: string;
  shortDesc: string;
  emoji: string;
  badgeColor: string;
}

export const AVAILABLE_STYLES: StyleOption[] = [
  { id: 'storytime_2d', name: 'Storytime 2D', shortDesc: 'Вебтун / YouTube-анимация', emoji: '🎨', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { id: 'paper_cutout', name: 'Paper Cutout', shortDesc: 'Вырезанная бумага / Сатира', emoji: '✂️', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { id: 'vintage_comic', name: 'Vintage Comic', shortDesc: 'Поп-арт 1960-х / Экшен', emoji: '💥', badgeColor: 'bg-red-500/20 text-red-300 border-red-500/40' },
  { id: 'retro_16bit', name: 'Retro 16-bit', shortDesc: 'Пиксель-арт / Игры', emoji: '👾', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  { id: 'rubber_hose_1930s', name: '1930s Rubber Hose', shortDesc: 'Винтаж 30-х / Нуар', emoji: '🎞️', badgeColor: 'bg-stone-500/20 text-stone-300 border-stone-500/40' },
  { id: 'sharpie_notebook', name: 'Sharpie Notebook', shortDesc: 'Маркер в тетрадке / Мем', emoji: '📝', badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
];

export interface ImageVariant {
  id: string;
  file: string;
  prompt?: string;
  created_at?: string;
}

export interface SceneImage {
  id: string;
  image_file?: string | null;
  prompt: string;
  style?: StylePresetId | string;
  start_time: number;
  duration?: number | null;
  word_index?: number;
  selected_text?: string;
  status: 'pending' | 'generating' | 'ready' | 'error';
  variants?: ImageVariant[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface Scene {
  id: number;
  shot_id: string;
  timing?: string;
  text: string;
  desc?: string;
  image_prompt?: string;
  style?: StylePresetId | string;
  image_file?: string | null;
  audio_file?: string | null;
  audio_duration?: number;
  image_status: 'pending' | 'generating' | 'ready' | 'error';
  audio_status: 'pending' | 'generating' | 'ready' | 'error';
  images?: SceneImage[];
  words?: WordTimestamp[];
}

export interface SubtitleSettings {
  font: string;
  highlight_color: string;
  primary_color?: string;
  font_size?: number;
  animation?: 'karaoke' | 'popup';
}

export interface BGMSettings {
  track: string;
  volume: number;
  fade_out?: boolean;
}

export interface MoviePassport {
  title?: string;
  genre?: string;
  characters?: string;
  lighting?: string;
}

export interface ProjectSettings {
  speed: number;
  voice_id: string;
  voice_name: string;
  model_id: string;
  resolution: string;
  aspect_ratio?: '16:9' | '9:16';
  style_preset: string;
  subtitles?: SubtitleSettings;
  bgm?: BGMSettings;
  movie_passport?: MoviePassport;
}

export interface BGMTrack {
  id: string;
  filename: string;
  title: string;
  category: string;
  duration: number;
  source_url?: string;
}

export interface Project {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  scenes: Scene[];
  settings: ProjectSettings;
}

export interface ProjectListItem {
  id: string;
  title: string;
  scenes_count: number;
  created_at: string;
  updated_at: string;
}

export interface TokenItem {
  key: string;
  active: boolean;
  remaining_chars: number;
  last_error?: string | null;
}

export interface RenderResult {
  success: boolean;
  video_path: string;
  video_rel: string;
  duration: number;
  size_mb: number;
}

export interface ShortsAndTikToksResult {
  shorts: Array<{
    name: string;
    duration: number;
    rel_path: string;
    size_mb: number;
  }>;
  tiktoks: Array<{
    name: string;
    duration: number;
    rel_path: string;
    size_mb: number;
  }>;
  subtitles_srt: string;
  subtitles_ass: string;
}

export interface ThumbnailOption {
  id: string;
  title: string;
  prompt: string;
  image_file?: string | null;
  status: 'pending' | 'generating' | 'ready' | 'error';
}

export interface ProjectThumbnails {
  project_id: string;
  thumbnails: ThumbnailOption[];
}

export interface PublishingMetadata {
  project_id: string;
  project_title: string;
  youtube_full: {
    title: string;
    description: string;
    tags: string;
  };
  youtube_shorts: Array<{
    part: number;
    title: string;
    description: string;
    tags: string;
  }>;
  tiktoks: Array<{
    part: number;
    description_with_tags: string;
  }>;
}
