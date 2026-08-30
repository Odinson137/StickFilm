import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Video,
  Scissors,
  Sparkles,
  CheckCircle2,
  Download,
  Film,
  AlertCircle,
  Gauge,
  FolderOpen,
  Copy,
  Check,
  FileText,
  Hash,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { RenderResult, ShortsAndTikToksResult, PublishingMetadata } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export const VideoStudioModal: React.FC<Props> = ({ isOpen, onClose, projectId }) => {
  const [activeTab, setActiveTab] = useState<'render' | 'metadata'>('render');
  const [speed, setSpeed] = useState<number>(1.2);
  const [motionEffect, setMotionEffect] = useState<string>('zoom_in');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [renderingFull, setRenderingFull] = useState<boolean>(false);
  const [renderingShorts, setRenderingShorts] = useState<boolean>(false);
  const [fullResult, setFullResult] = useState<RenderResult | null>(null);
  const [shortsResult, setShortsResult] = useState<ShortsAndTikToksResult | null>(null);
  const [metadata, setMetadata] = useState<PublishingMetadata | null>(null);
  const [loadingMeta, setLoadingMeta] = useState<boolean>(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [openedFolderPath, setOpenedFolderPath] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const speedOptions = [1.0, 1.1, 1.15, 1.2, 1.25, 1.3, 1.5];

  const motionOptions = [
    {
      id: 'zoom_in',
      label: '🔍 Наезд (106%)',
      badge: 'ТОП',
      desc: 'Медленный наезд к центру (Ken Burns)',
    },
    {
      id: 'alternate',
      label: '🔄 Чередование',
      desc: 'Кадр 1 наезд, Кадр 2 отъезд',
    },
    {
      id: 'snap_punch',
      label: '⚡ Импакт-зум',
      desc: 'Резкий скачок 112% на старте кадра',
    },
    {
      id: 'whip_pan',
      label: '💨 Комикс-сдвиг',
      desc: 'Быстрый сдвиг в начале кадра',
    },
    {
      id: 'none',
      label: '⏹️ Статика',
      desc: 'Классический жесткий стык без зума',
    },
  ];

  const fetchMetadata = async () => {
    setLoadingMeta(true);
    try {
      const data = await api.getMetadata(projectId);
      setMetadata(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMeta(false);
    }
  };

  const fetchProjectInfo = async () => {
    try {
      const p = await api.getProject(projectId);
      if (p?.settings?.aspect_ratio) {
        setAspectRatio(p.settings.aspect_ratio);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjectInfo();
      fetchMetadata();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRenderFull = async () => {
    setError(null);
    setRenderingFull(true);
    try {
      const res = await api.renderFullVideo(projectId, speed, motionEffect, aspectRatio);
      setFullResult(res);
      setActiveVideoUrl(api.getMediaUrl(projectId, res.video_rel));
      await fetchMetadata();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setRenderingFull(false);
    }
  };

  const handleRenderShorts = async () => {
    setError(null);
    setRenderingShorts(true);
    try {
      const res = await api.renderShortsAndTikToks(projectId, speed, motionEffect, aspectRatio);
      setShortsResult(res);
      await fetchMetadata();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setRenderingShorts(false);
    }
  };

  const handleOpenFolder = async (subfolder: string = 'output') => {
    try {
      const res = await api.openFolder(projectId, subfolder);
      setOpenedFolderPath(res.path);
      setTimeout(() => setOpenedFolderPath(null), 4000);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Видео Студия & Публикация</h3>
              <p className="text-xs text-slate-400">Сборка видео, авто-нарезка с субтитрами и генерация названий/тегов</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center bg-dark-900 p-1 rounded-xl border border-dark-700">
              <button
                onClick={() => setActiveTab('render')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'render'
                    ? 'bg-amber-500 text-dark-900 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Сборка & Экспорт</span>
              </button>

              <button
                onClick={() => setActiveTab('metadata')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  activeTab === 'metadata'
                    ? 'bg-amber-500 text-dark-900 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Названия & Теги (SEO)</span>
              </button>
            </div>

            <button
              onClick={() => handleOpenFolder('output')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 text-slate-200 text-xs font-semibold rounded-xl border border-dark-600 transition"
              title="Открыть папку с видео в проводнике Windows"
            >
              <FolderOpen className="w-4 h-4 text-amber-400" />
              <span>Папка на диске</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-dark-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {openedFolderPath && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Папка открыта в Проводнике: <strong>{openedFolderPath}</strong></span>
            </div>
          )}

          {/* TAB 1: RENDER & EXPORT */}
          {activeTab === 'render' && (
            <div className="flex flex-col gap-6">
              {/* Master Speed Selector Banner */}
              <div className="bg-dark-900/90 border border-dark-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Gauge className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">Скорость воспроизведения (Voice & Video Speed)</h4>
                    <p className="text-[11px] text-slate-400">Ускорение рекапа: сохраняет естественный тон голоса без питч-шифта</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {speedOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition ${
                        speed === s
                          ? 'bg-amber-500 text-dark-900 shadow-md ring-2 ring-amber-400'
                          : 'bg-dark-800 text-slate-300 hover:bg-dark-700 border border-dark-700'
                      }`}
                    >
                      {s.toFixed(2).replace(/\.?0+$/, '')}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Motion & Zoom Selector */}
              <div className="bg-dark-900/90 border border-dark-700 rounded-2xl p-4 flex flex-col gap-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-100">Анимация камеры и зум картинок (Ken Burns)</h4>
                      <p className="text-[11px] text-slate-400">Плавные кинематографичные движения для удержания внимания зрителя</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {motionOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setMotionEffect(opt.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                        motionEffect === opt.id
                          ? 'bg-blue-500/15 border-blue-500 text-slate-100 ring-1 ring-blue-400 shadow-md'
                          : 'bg-dark-950 border-dark-700 text-slate-400 hover:border-dark-600 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs font-bold text-slate-200">{opt.label}</span>
                        {opt.badge && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 leading-tight">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Player if available */}
              {activeVideoUrl && (
                <div className="bg-dark-900 rounded-2xl border border-dark-700 overflow-hidden flex flex-col items-center p-4">
                  <video
                    src={activeVideoUrl}
                    controls
                    autoPlay
                    className="max-h-72 rounded-xl shadow-lg border border-dark-800"
                  />
                </div>
              )}

              {/* Controls & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. Full Video Card */}
                <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                        <Film className="w-4 h-4 text-amber-400" />
                        <span>
                          {aspectRatio === '9:16'
                            ? '1. Вертикальное видео (1080x1920 9:16)'
                            : '1. Основное видео (1080p 16:9)'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md font-bold">
                        {speed}x
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {aspectRatio === '9:16'
                        ? `Склейка всех 9:16 вертикальных кадров и реплик со скоростью ${speed}x в нативном вертикальном качестве для Shorts/TikTok.`
                        : `Склейка всех 16:9 кадров и реплик со скоростью ${speed}x для YouTube.`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleRenderFull}
                      disabled={renderingFull}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-dark-900 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {renderingFull
                          ? 'Сборка и рендеринг...'
                          : aspectRatio === '9:16'
                          ? `Собрать вертикальное 9:16 (${speed}x)`
                          : `Собрать видео 1080p (${speed}x)`}
                      </span>
                    </button>

                    {fullResult && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center justify-between">
                        <span>Готово: {fullResult.duration} сек ({fullResult.size_mb} MB)</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenFolder('output')}
                            className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-slate-300 hover:text-emerald-400 transition"
                            title="Открыть папку в проводнике"
                          >
                            <FolderOpen className="w-4 h-4" />
                          </button>
                          <a
                            href={api.getDownloadUrl(projectId, fullResult.video_rel)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow transition"
                            title="Скачать файл прямо на компьютер"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Скачать</span>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Shorts & TikToks Slicer Card */}
                <div className="bg-dark-900/60 border border-dark-700 rounded-2xl p-5 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                        <Scissors className="w-4 h-4 text-purple-400" />
                        <span>
                          {aspectRatio === '9:16'
                            ? '2. Нарезка на части с субтитрами'
                            : '2. Shorts & TikToks (9:16)'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-bold">
                        {speed}x
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {aspectRatio === '9:16'
                        ? `Авто-нарезка на 100% хронометража: Shorts (< 60 сек) и TikToks (> 60 сек) с наложением анимированных караоке-субтитров Whisper прямо на видео.`
                        : `Авто-нарезка на 100% хронометража со скоростью ${speed}x: Shorts (< 60 сек) и TikToks (> 60 сек) с караоке-субтитрами Whisper.`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleRenderShorts}
                      disabled={renderingShorts}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2"
                    >
                      <Scissors className="w-4 h-4" />
                      <span>{renderingShorts ? 'Нарезка и генерация субтитров...' : `Нарезать Shorts и TikToks (${speed}x)`}</span>
                    </button>

                    {shortsResult && (
                      <div className="flex flex-col gap-3 mt-2">
                        {/* Shorts list */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-purple-300">
                              YouTube Shorts ({shortsResult.shorts.length} части, &lt; 60с):
                            </span>
                            <button
                              onClick={() => handleOpenFolder('output/shorts')}
                              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 hover:underline"
                            >
                              <FolderOpen className="w-3 h-3" />
                              <span>Папка Shorts</span>
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            {shortsResult.shorts.map((s, idx) => (
                              <div
                                key={s.name}
                                className="flex items-center justify-between p-2 bg-dark-800 rounded-lg text-xs border border-dark-700"
                              >
                                <span className="font-semibold text-slate-200">
                                  Часть {idx + 1} ({s.duration} сек)
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setActiveVideoUrl(api.getMediaUrl(projectId, s.rel_path))}
                                    className="px-2 py-1 bg-dark-700 hover:bg-dark-600 rounded text-[10px] text-slate-300 transition"
                                  >
                                    Смотреть
                                  </button>
                                  <a
                                    href={api.getDownloadUrl(projectId, s.rel_path)}
                                    className="flex items-center gap-1 px-2 py-1 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 rounded text-[10px] font-semibold transition"
                                    title="Скачать MP4 прямо на компьютер"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Скачать</span>
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* TikToks list */}
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-blue-300">
                              TikToks & Reels ({shortsResult.tiktoks.length} части, &gt; 60с):
                            </span>
                            <button
                              onClick={() => handleOpenFolder('output/tiktoks')}
                              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline"
                            >
                              <FolderOpen className="w-3 h-3" />
                              <span>Папка TikToks</span>
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            {shortsResult.tiktoks.map((t, idx) => (
                              <div
                                key={t.name}
                                className="flex items-center justify-between p-2 bg-dark-800 rounded-lg text-xs border border-dark-700"
                              >
                                <span className="font-semibold text-slate-200">
                                  Часть {idx + 1} ({t.duration} сек)
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setActiveVideoUrl(api.getMediaUrl(projectId, t.rel_path))}
                                    className="px-2 py-1 bg-dark-700 hover:bg-dark-600 rounded text-[10px] text-slate-300 transition"
                                  >
                                    Смотреть
                                  </button>
                                  <a
                                    href={api.getDownloadUrl(projectId, t.rel_path)}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 rounded text-[10px] font-semibold transition"
                                    title="Скачать MP4 прямо на компьютер"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Скачать</span>
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: METADATA & SEO TAGS */}
          {activeTab === 'metadata' && (
            <div className="flex flex-col gap-6">
              {loadingMeta && !metadata ? (
                <div className="py-16 text-center text-xs text-slate-400">Генерация метаданных и тегов...</div>
              ) : metadata ? (
                <div className="flex flex-col gap-6">
                  {/* Notice banner */}
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <span>Файл <strong>publishing_metadata.txt</strong> автоматически сохранён в папке проекта.</span>
                    </div>
                    <button
                      onClick={() => handleOpenFolder('output')}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-dark-900 font-bold text-[11px] rounded-lg transition"
                    >
                      Открыть файл
                    </button>
                  </div>

                  {/* 1. YouTube Full Video Meta */}
                  <div className="bg-dark-900 border border-dark-700 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                      <Film className="w-4 h-4 text-amber-400" />
                      <span>1. YouTube (Основное Полное Видео)</span>
                    </div>

                    {/* Title */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-400">Название (Title):</label>
                        <button
                          onClick={() => handleCopy('yt_full_title', metadata.youtube_full.title)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                        >
                          {copiedKey === 'yt_full_title' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'yt_full_title' ? 'Скопировано!' : 'Копировать название'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={metadata.youtube_full.title}
                        className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-400">Описание (Description):</label>
                        <button
                          onClick={() => handleCopy('yt_full_desc', metadata.youtube_full.description)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                        >
                          {copiedKey === 'yt_full_desc' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'yt_full_desc' ? 'Скопировано!' : 'Копировать описание'}</span>
                        </button>
                      </div>
                      <textarea
                        readOnly
                        rows={4}
                        value={metadata.youtube_full.description}
                        className="w-full bg-dark-950 border border-dark-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>

                    {/* Tags */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-400">Теги (Tags):</label>
                        <button
                          onClick={() => handleCopy('yt_full_tags', metadata.youtube_full.tags)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                        >
                          {copiedKey === 'yt_full_tags' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey === 'yt_full_tags' ? 'Скопировано!' : 'Копировать все теги'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={metadata.youtube_full.tags}
                        className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-300 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 2. YouTube Shorts Meta */}
                  <div className="bg-dark-900 border border-dark-700 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                      <Scissors className="w-4 h-4 text-purple-400" />
                      <span>2. YouTube Shorts (по частям)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {metadata.youtube_shorts.map((s) => (
                        <div key={s.part} className="bg-dark-950 border border-dark-700 rounded-xl p-3.5 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-400">Shorts Часть #{s.part}</span>
                            <button
                              onClick={() => handleCopy(`shorts_${s.part}`, `${s.title}\n\n${s.description}\n\nTags: ${s.tags}`)}
                              className="text-[10px] text-purple-300 hover:text-purple-200 flex items-center gap-1 bg-dark-800 px-2 py-1 rounded transition"
                            >
                              {copiedKey === `shorts_${s.part}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>Всё</span>
                            </button>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-slate-400">Название:</span>
                            <div className="flex items-center justify-between bg-dark-900 p-2 rounded-lg border border-dark-800 text-[11px] text-slate-200">
                              <span className="truncate">{s.title}</span>
                              <button onClick={() => handleCopy(`sh_title_${s.part}`, s.title)} className="ml-2 hover:text-amber-400">
                                {copiedKey === `sh_title_${s.part}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-slate-400">Описание:</span>
                            <div className="bg-dark-900 p-2 rounded-lg border border-dark-800 text-[11px] text-slate-300 max-h-20 overflow-y-auto leading-relaxed">
                              {s.description}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-semibold text-slate-400">Теги:</span>
                            <div className="flex items-center justify-between bg-dark-900 p-1.5 rounded-lg border border-dark-800 text-[10px] text-slate-400 font-mono">
                              <span className="truncate">{s.tags}</span>
                              <button onClick={() => handleCopy(`sh_tags_${s.part}`, s.tags)} className="ml-1 hover:text-amber-400">
                                {copiedKey === `sh_tags_${s.part}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. TikToks & Reels Meta */}
                  <div className="bg-dark-900 border border-dark-700 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-slate-100 font-bold text-sm">
                      <Hash className="w-4 h-4 text-blue-400" />
                      <span>3. TikToks & Instagram Reels (Описание с вирусными хэштегами)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {metadata.tiktoks.map((t) => (
                        <div key={t.part} className="bg-dark-950 border border-dark-700 rounded-xl p-4 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-400">TikTok Часть #{t.part}</span>
                            <button
                              onClick={() => handleCopy(`tk_${t.part}`, t.description_with_tags)}
                              className="text-xs text-blue-300 hover:text-blue-200 flex items-center gap-1 bg-dark-800 px-3 py-1.5 rounded-lg transition"
                            >
                              {copiedKey === `tk_${t.part}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedKey === `tk_${t.part}` ? 'Скопировано!' : 'Копировать для TikTok'}</span>
                            </button>
                          </div>

                          <div className="p-3 bg-dark-900 rounded-xl border border-dark-800 text-xs text-slate-200 leading-relaxed select-text">
                            {t.description_with_tags}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-800/80 rounded-b-2xl">
          <button
            onClick={() => handleOpenFolder('output')}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Открыть всю папку проекта в Проводнике Windows</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-300 hover:bg-dark-700 rounded-xl transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
