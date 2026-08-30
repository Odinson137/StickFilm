import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Settings, Music, Type, Film, Play, Pause, Download, 
  Upload, Check, Volume2, Sparkles, RefreshCw, AlertCircle, 
  Sliders, Palette
} from 'lucide-react';
import { Project, ProjectSettings, BGMTrack } from '../types';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdateProject: (updated: Project) => void;
}

const GENRE_SUBTITLE_PRESETS = [
  { genre: 'Триллер / Детектив', color: '#FF2A2A', name: 'Кроваво-красный', font: 'Impact', emoji: '🔪' },
  { genre: 'Комедия / Сторитайм', color: '#FFE600', name: 'Ярко-желтый', font: 'Impact', emoji: '😂' },
  { genre: 'Хоррор / Мистика', color: '#39FF14', name: 'Токсично-зеленый', font: 'Impact', emoji: '👻' },
  { genre: 'Сай-Фай / Неон', color: '#00FFFF', name: 'Неоновый Циан', font: 'Impact', emoji: '🚀' },
  { genre: 'Киберпанк / Экшен', color: '#FF007F', name: 'Маджента Неон', font: 'Impact', emoji: '⚡' },
  { genre: 'Классический белый', color: '#FFFFFF', name: 'Белый с тенью', font: 'Impact', emoji: '🎬' },
];

export const ProjectSettingsModal: React.FC<Props> = ({ isOpen, onClose, project, onUpdateProject }) => {
  const [activeTab, setActiveTab] = useState<'subtitles' | 'bgm' | 'movie'>('subtitles');
  
  // Subtitle state
  const currentSub = project.settings?.subtitles || {
    font: 'Impact',
    highlight_color: '#00E6FF',
    primary_color: '#FFFFFF',
    font_size: 68,
    animation: 'karaoke',
  };
  const [subFont, setSubFont] = useState<string>(currentSub.font || 'Impact');
  const [subHighlightColor, setSubHighlightColor] = useState<string>(currentSub.highlight_color || '#00E6FF');
  const [subFontSize, setSubFontSize] = useState<number>(currentSub.font_size || 68);
  const [subAnimation, setSubAnimation] = useState<'karaoke' | 'popup'>(currentSub.animation || 'karaoke');

  // BGM state
  const currentBgm = project.settings?.bgm || { track: '', volume: 0.15, fade_out: true };
  const [bgmTrack, setBgmTrack] = useState<string>(currentBgm.track || '');
  const [bgmVolume, setBgmVolume] = useState<number>(currentBgm.volume ?? 0.15);
  const [bgmFadeOut, setBgmFadeOut] = useState<boolean>(currentBgm.fade_out ?? true);
  const [tracksList, setTracksList] = useState<BGMTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState<boolean>(false);

  // YouTube downloader state
  const [ytUrl, setYtUrl] = useState<string>('');
  const [ytTitle, setYtTitle] = useState<string>('');
  const [ytDownloading, setYtDownloading] = useState<boolean>(false);
  const [ytError, setYtError] = useState<string | null>(null);

  // Audio player state
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Movie passport state
  const currentMovie = project.settings?.movie_passport || { title: '', genre: 'thriller', characters: '', lighting: '' };
  const [movieGenre, setMovieGenre] = useState<string>(currentMovie.genre || 'thriller');
  const [movieCharacters, setMovieCharacters] = useState<string>(currentMovie.characters || '');
  const [movieLighting, setMovieLighting] = useState<string>(currentMovie.lighting || '');

  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadTracks();
    } else {
      stopAudio();
    }
  }, [isOpen]);

  const loadTracks = async () => {
    try {
      setLoadingTracks(true);
      const list = await api.getBGMTracks();
      setTracksList(list);
    } catch (e) {
      console.error('Failed to load BGM tracks:', e);
    } finally {
      setLoadingTracks(false);
    }
  };

  const togglePlayAudio = (filename: string) => {
    if (playingTrack === filename) {
      stopAudio();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const streamUrl = api.getBGMStreamUrl(filename);
      audioRef.current = new Audio(streamUrl);
      audioRef.current.volume = bgmVolume;
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingTrack(null);
      setPlayingTrack(filename);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingTrack(null);
  };

  const handleDownloadYouTube = async () => {
    if (!ytUrl.trim()) return;
    try {
      setYtDownloading(true);
      setYtError(null);
      const newTrack = await api.downloadBGMFromYouTube(ytUrl, ytTitle || undefined);
      setBgmTrack(newTrack.filename);
      setYtUrl('');
      setYtTitle('');
      await loadTracks();
    } catch (err: any) {
      setYtError(err.response?.data?.detail || err.message || 'Ошибка скачивания с YouTube');
    } finally {
      setYtDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setLoadingTracks(true);
      const newTrack = await api.uploadBGMTrack(file);
      setBgmTrack(newTrack.filename);
      await loadTracks();
    } catch (err: any) {
      alert('Ошибка загрузки аудиофайла: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleApplyPreset = (preset: typeof GENRE_SUBTITLE_PRESETS[0]) => {
    setSubHighlightColor(preset.color);
    setSubFont(preset.font);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const newSettings: Partial<ProjectSettings> = {
        ...project.settings,
        subtitles: {
          font: subFont,
          highlight_color: subHighlightColor,
          primary_color: '#FFFFFF',
          font_size: subFontSize,
          animation: subAnimation,
        },
        bgm: {
          track: bgmTrack,
          volume: bgmVolume,
          fade_out: bgmFadeOut,
        },
        movie_passport: {
          title: project.title,
          genre: movieGenre,
          characters: movieCharacters,
          lighting: movieLighting,
        },
      };

      const updated = await api.updateProjectSettings(project.id, newSettings);
      onUpdateProject(updated);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert('Ошибка сохранения настроек: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="bg-dark-850 border border-dark-700 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Настройки проекта
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-dark-750 text-slate-400 border border-dark-650 font-normal">
                  {project.title}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Стили субтитров, фоновая музыка и жанровый паспорт фильма</p>
            </div>
          </div>

          <button
            onClick={() => { stopAudio(); onClose(); }}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-dark-750 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-dark-750 bg-dark-900/40">
          <button
            onClick={() => { stopAudio(); setActiveTab('subtitles'); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'subtitles'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Субтитры и Цвета</span>
          </button>

          <button
            onClick={() => setActiveTab('bgm')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'bgm'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>Фоновая музыка (BGM)</span>
            {bgmTrack && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => { stopAudio(); setActiveTab('movie'); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              activeTab === 'movie'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Паспорт фильма и Герои</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* TAB 1: SUBTITLES */}
          {activeTab === 'subtitles' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Жанровые пресеты подсветки:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {GENRE_SUBTITLE_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleApplyPreset(p)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs transition ${
                          subHighlightColor.toLowerCase() === p.color.toLowerCase()
                            ? 'bg-amber-500/10 border-amber-500/50 text-slate-100 font-semibold'
                            : 'bg-dark-800 border-dark-700 text-slate-400 hover:text-slate-200 hover:border-dark-600'
                        }`}
                      >
                        <span className="text-base">{p.emoji}</span>
                        <div className="flex-1 truncate">
                          <div className="truncate text-slate-200">{p.genre}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: p.color }} />
                            <span className="text-[10px] text-slate-400">{p.name}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-dark-750">
                  {/* Font picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Шрифт субтитров</label>
                    <select
                      value={subFont}
                      onChange={(e) => setSubFont(e.target.value)}
                      className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Impact">Impact (Классический Shorts / TikTok)</option>
                      <option value="Montserrat">Montserrat Black (Современный жирный)</option>
                      <option value="Arial Black">Arial Black</option>
                      <option value="Komika Axis">Komika Axis (Комиксный стиль)</option>
                      <option value="Press Start 2P">Press Start 2P (Ретро 8-bit)</option>
                    </select>
                  </div>

                  {/* Highlight Color Custom Picker */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Цвет подсветки активного слова</span>
                      <span className="font-mono text-[11px] text-amber-400">{subHighlightColor}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={subHighlightColor}
                        onChange={(e) => setSubHighlightColor(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer bg-dark-800 border border-dark-700 p-1"
                      />
                      <input
                        type="text"
                        value={subHighlightColor}
                        onChange={(e) => setSubHighlightColor(e.target.value)}
                        className="flex-1 bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-200 uppercase focus:outline-none focus:border-amber-500"
                        placeholder="#00E6FF"
                      />
                    </div>
                  </div>

                  {/* Font size */}
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                      <span>Размер текста</span>
                      <span className="text-amber-400 font-mono">{subFontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="40"
                      max="90"
                      step="2"
                      value={subFontSize}
                      onChange={(e) => setSubFontSize(Number(e.target.value))}
                      className="w-full accent-amber-500 bg-dark-700 h-1.5 rounded-lg cursor-pointer"
                    />
                  </div>

                  {/* Animation Style */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Анимация текста</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSubAnimation('karaoke')}
                        className={`p-3 rounded-xl border text-xs font-semibold transition text-left ${
                          subAnimation === 'karaoke'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                            : 'bg-dark-800 border-dark-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-slate-200">Караоке пульс</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-normal">Фраза из 3–4 слов, текущее слово подсвечивается и растет (+15%)</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSubAnimation('popup')}
                        className={`p-3 rounded-xl border text-xs font-semibold transition text-left ${
                          subAnimation === 'popup'
                            ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                            : 'bg-dark-800 border-dark-700 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <div className="font-bold text-slate-200">Одиночный Pop-up</div>
                        <div className="text-[11px] text-slate-400 mt-1 font-normal">Ровно одно слово по центру экрана с резким появлением</div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Preview */}
              <div className="flex flex-col items-center justify-center p-6 bg-dark-900/80 rounded-2xl border border-dark-700 relative overflow-hidden min-h-[320px]">
                <div className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Предпросмотр на экране 9:16
                </div>

                <div className="w-[200px] h-[340px] bg-gradient-to-b from-dark-800 to-dark-950 rounded-2xl border border-dark-600 shadow-2xl relative flex flex-col justify-end p-4 items-center">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Mock Subtitles */}
                  <div className="z-10 text-center mb-8">
                    {subAnimation === 'karaoke' ? (
                      <div className="text-white font-extrabold tracking-wide uppercase drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]" style={{ fontFamily: subFont }}>
                        <span className="text-slate-300 text-xs mr-1.5">FLAWLESS</span>
                        <span 
                          className="inline-block text-sm px-1 rounded transition-transform scale-110" 
                          style={{ color: subHighlightColor, textShadow: `0 0 10px ${subHighlightColor}80` }}
                        >
                          MEDICAL
                        </span>
                        <span className="text-slate-300 text-xs ml-1.5">SECURITY</span>
                      </div>
                    ) : (
                      <div 
                        className="text-base font-black uppercase tracking-wider scale-125 animate-pulse"
                        style={{ fontFamily: subFont, color: subHighlightColor, textShadow: `0 0 14px ${subHighlightColor}` }}
                      >
                        SECURITY!
                      </div>
                    )}
                  </div>

                  <div className="w-full text-center py-1.5 bg-dark-900/80 rounded-lg text-[9px] text-slate-400 font-mono border border-dark-750">
                    9:16 Shorts Mobile Screen
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BGM / MUSIC */}
          {activeTab === 'bgm' && (
            <div className="space-y-6">
              {/* Volume & Fade controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-dark-800/80 rounded-2xl border border-dark-700">
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      Громкость музыки в видео
                    </span>
                    <span className="text-amber-400 font-mono font-bold">{Math.round(bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.40"
                    step="0.01"
                    value={bgmVolume}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setBgmVolume(v);
                      if (audioRef.current) audioRef.current.volume = v;
                    }}
                    className="w-full accent-amber-500 bg-dark-700 h-2 rounded-lg cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Рекомендуется 12%–18%, чтобы голос оставался четким и на переднем плане</p>
                </div>

                <div className="flex items-center justify-between pl-0 md:pl-4 border-t md:border-t-0 md:border-l border-dark-700 pt-3 md:pt-0">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Авто-затухание в конце (Fade Out)</div>
                    <div className="text-[11px] text-slate-400">Плавно приглушать музыку за 1.5 сек до конца видео</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={bgmFadeOut}
                    onChange={(e) => setBgmFadeOut(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* YouTube Downloader & Upload */}
              <div className="p-4 bg-dark-900/60 rounded-2xl border border-dark-750 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-red-400" />
                    Скачать фоновый трек с YouTube:
                  </span>
                  
                  <label className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 cursor-pointer bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Загрузить свой MP3</span>
                    <input type="file" accept="audio/mp3,audio/wav,audio/mpeg" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    value={ytUrl}
                    onChange={(e) => setYtUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <input
                    type="text"
                    value={ytTitle}
                    onChange={(e) => setYtTitle(e.target.value)}
                    placeholder="Название трека (опционально)"
                    className="w-full sm:w-56 bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    onClick={handleDownloadYouTube}
                    disabled={ytDownloading || !ytUrl.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-xl transition whitespace-nowrap"
                  >
                    {ytDownloading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Скачивание...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Скачать MP3</span>
                      </>
                    )}
                  </button>
                </div>

                {ytError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{ytError}</span>
                  </div>
                )}
              </div>

              {/* Tracks Library */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Библиотека треков проекта:
                  </label>
                  <button
                    onClick={() => setBgmTrack('')}
                    className={`text-xs px-2.5 py-1 rounded-lg transition ${
                      !bgmTrack ? 'bg-dark-700 text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Без фоновой музыки
                  </button>
                </div>

                {loadingTracks ? (
                  <div className="py-8 text-center text-xs text-slate-400">Загрузка треков...</div>
                ) : tracksList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 bg-dark-900/30 rounded-xl border border-dark-800">
                    В библиотеке пока нет треков. Вставьте ссылку с YouTube выше или загрузите MP3.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {tracksList.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setBgmTrack(t.filename)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                          bgmTrack === t.filename
                            ? 'bg-amber-500/10 border-amber-500/60 shadow-md shadow-amber-500/5'
                            : 'bg-dark-800 border-dark-700 hover:border-dark-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); togglePlayAudio(t.filename); }}
                            className={`p-2 rounded-lg transition ${
                              playingTrack === t.filename
                                ? 'bg-amber-500 text-dark-900'
                                : 'bg-dark-700 text-slate-300 hover:text-white hover:bg-dark-650'
                            }`}
                          >
                            {playingTrack === t.filename ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-200 truncate">{t.title}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span className="capitalize">{t.category}</span>
                              {t.duration > 0 && <span>• {Math.floor(t.duration / 60)}:{Math.floor(t.duration % 60).toString().padStart(2, '0')}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {bgmTrack === t.filename && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" /> Выбран
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MOVIE PASSPORT */}
          {activeTab === 'movie' && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Паспорт фильма для генерации промптов:</strong> Эти данные будут автоматически передаваться Claude и генератору артов, чтобы персонажи не меняли внешность от кадра к кадру, а свет соответствовал жанру.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Жанр фильма</label>
                <select
                  value={movieGenre}
                  onChange={(e) => setMovieGenre(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="thriller">Психологический триллер / Маньяки</option>
                  <option value="horror">Хоррор / Мистика</option>
                  <option value="comedy">Комедия / Пародия / Ситком</option>
                  <option value="action">Боевик / Экшен 90-х</option>
                  <option value="scifi">Сай-Фай / Киберпанк</option>
                  <option value="detective">Нуарный детектив / Криминал</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Внешность и черты главных героев (Character Anchors)
                </label>
                <textarea
                  value={movieCharacters}
                  onChange={(e) => setMovieCharacters(e.target.value)}
                  rows={3}
                  placeholder="Например: Дженнифер (длинные темные волнистые волосы, желтая куртка), Рассел (зализанные черные волосы, черная водолазка, кривая ухмылка), Детектив (помятый бежевый плащ, щетина)"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Светотеневая жанровая палитра (Lighting & Atmosphere)
                </label>
                <textarea
                  value={movieLighting}
                  onChange={(e) => setMovieLighting(e.target.value)}
                  rows={2}
                  placeholder="Например: Moody cold teal moonlight, rain mist, dark ominous shadows, fog, mysterious glowing windows"
                  className="w-full bg-dark-800 border border-dark-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
                />
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-900/60 rounded-b-2xl">
          <div className="text-xs text-slate-400">
            {savedSuccess ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check className="w-4 h-4" /> Настройки успешно сохранены!
              </span>
            ) : (
              <span>Настройки применятся ко всем будущим рендерам и генерациям</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { stopAudio(); onClose(); }}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dark-750 rounded-xl transition"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-dark-900 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Сохранить настройки</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
