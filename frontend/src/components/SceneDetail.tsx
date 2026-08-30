import React, { useState, useEffect } from 'react';
import { Scene, SceneImage, AVAILABLE_STYLES, StylePresetId } from '../types';
import { api } from '../services/api';
import { ImageVersionsModal } from './ImageVersionsModal';
import {
  Mic,
  Image as ImageIcon,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
  Clock,
  Video,
  Upload,
  XCircle,
  Layers, AlertTriangle,
  Palette, Sparkles
} from 'lucide-react';

interface Props {
  scene: Scene | null;
  projectId: string;
  aspectRatio?: '16:9' | '9:16';
  onUpdateScene: (updated: Scene) => void;
  onPrevScene: () => void;
  onNextScene: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onBatchAudio: () => void;
  onBatchImages: () => void;
  onStopBatchImages?: () => void;
  isBatchAudioLoading: boolean;
  isBatchImagesLoading: boolean;
  batchProgress?: { isRunning: boolean; current: number; total: number; label: string };
}

export const SceneDetail: React.FC<Props> = ({
  scene,
  projectId,
  aspectRatio = '16:9',
  onUpdateScene,
  onPrevScene,
  onNextScene,
  hasPrev,
  hasNext,
  onBatchAudio,
  onBatchImages,
  onStopBatchImages,
  isBatchAudioLoading,
  isBatchImagesLoading,
  batchProgress,
}) => {
  const [text, setText] = useState<string>('');
  const [audioLoading, setAudioLoading] = useState<boolean>(false);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState<number>(Date.now());
  const [selectedImageForVersions, setSelectedImageForVersions] = useState<SceneImage | null>(null);

  const handleVariantUpdated = async () => {
    setImageVersion(Date.now());
    try {
      const proj = await api.getProject(projectId);
      if (scene) {
        const latestScene = proj.scenes.find((s) => s.id === scene.id);
        if (latestScene) {
          onUpdateScene(latestScene);
          if (selectedImageForVersions) {
            const updatedImg = latestScene.images?.find((im) => im.id === selectedImageForVersions.id);
            if (updatedImg) {
              setSelectedImageForVersions(updatedImg);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (scene) {
      setText(scene.text || '');
      setIsPlaying(false);
      setImageVersion(Date.now());
      if (audioElement) {
        audioElement.pause();
      }
    }
  }, [scene?.id]);

  if (!scene) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-900 text-slate-500 text-sm">
        Выберите сцену слева для начала редактирования.
      </div>
    );
  }

  // Ensure scene has images array with at least 1 item
  const images: SceneImage[] = scene.images && scene.images.length > 0 ? scene.images : [
    {
      id: 'img_1',
      image_file: scene.image_file || `shots/${scene.shot_id}.png`,
      prompt: scene.image_prompt || scene.desc || scene.text,
      start_time: 0.0,
      duration: scene.audio_duration,
      status: scene.image_status || 'pending',
    }
  ];

  const handleGenerateAudio = async () => {
    if (!text.trim()) return;
    setAudioLoading(true);
    setError(null);
    try {
      const res = await api.generateSingleAudio(projectId, scene.id, text);
      const audioPath = res.audio_file || res.file || scene.audio_file || `audio/voice_${String(scene.id).padStart(2, '0')}.mp3`;
      const updated: Scene = {
        ...scene,
        text,
        audio_file: audioPath,
        audio_duration: res.duration || res.audio_duration || scene.audio_duration,
        audio_status: 'ready',
        words: res.words || [],
      };
      onUpdateScene(updated);
      setImageVersion(Date.now());
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Ошибка генерации аудио');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleGenerateSingleImage = async (imgId: string, promptText: string) => {
    setError(null);
    setGeneratingImageId(imgId);
    try {
      await api.generateSingleImage(projectId, scene.id, promptText, imgId, aspectRatio);
      
      setImageVersion(Date.now());
      const proj = await api.getProject(projectId);
      const latestScene = proj.scenes.find((s) => s.id === scene.id);
      if (latestScene) {
        onUpdateScene(latestScene);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setGeneratingImageId(null);
    }
  };

  const handleAddImage = async () => {
    setError(null);
    try {
      const nextIdx = images.length + 1;
      const autoStartTime = scene.audio_duration ? (scene.audio_duration / (images.length + 1)) * images.length : 0;
      const defaultPrompt = aspectRatio === '9:16'
        ? `Crude stick figure doodle, MS Paint style, pure white background, thick black marker lines, 9:16`
        : `Crude stick figure doodle, MS Paint style, pure white background, thick black marker lines, 16:9`;

      await api.addSceneImage(projectId, scene.id, {
        word_index: nextIdx,
        selected_text: `Кадр #${nextIdx}`,
        start_time: autoStartTime,
        prompt: defaultPrompt,
      });

      setImageVersion(Date.now());
      const proj = await api.getProject(projectId);
      const latestScene = proj.scenes.find((s) => s.id === scene.id);
      if (latestScene) {
        onUpdateScene(latestScene);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleDeleteImage = async (imgId: string) => {
    if (images.length <= 1) return;
    setError(null);
    try {
      await api.deleteSceneImage(projectId, scene.id, imgId);
      setImageVersion(Date.now());
      const proj = await api.getProject(projectId);
      const latestScene = proj.scenes.find((s) => s.id === scene.id);
      if (latestScene) {
        onUpdateScene(latestScene);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleImagePromptChange = (imgId: string, val: string) => {
    const updatedImages = images.map((img) => (img.id === imgId ? { ...img, prompt: val } : img));
    onUpdateScene({ ...scene, images: updatedImages });
  };

  const handleImageStyleChange = async (imgId: string, newStyle: string) => {
    try {
      const updatedImages = images.map((img) => (img.id === imgId ? { ...img, style: newStyle } : img));
      onUpdateScene({ ...scene, images: updatedImages });
      await api.updateImageStyle(projectId, scene.id, imgId, newStyle);
    } catch (err: any) {
      console.error('Failed to update style:', err);
    }
  };

  const handleVideoUpload = async (imgId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImageId(imgId);
    setError(null);
    try {
      await api.uploadVideoClip(projectId, scene.id, file, imgId);
      setImageVersion(Date.now());
      const proj = await api.getProject(projectId);
      const latestScene = proj.scenes.find((s) => s.id === scene.id);
      if (latestScene) {
        onUpdateScene(latestScene);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Ошибка загрузки видео');
    } finally {
      setUploadingImageId(null);
      e.target.value = '';
    }
  };

  const togglePlayAudio = () => {
    if (!scene.audio_file) return;
    const url = `${api.getMediaUrl(projectId, scene.audio_file)}?v=${imageVersion}`;
    if (!audioElement || audioElement.src !== url) {
      const newAudio = new Audio(url);
      newAudio.onended = () => setIsPlaying(false);
      setAudioElement(newAudio);
      newAudio.play();
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    }
  };

  return (
    <main className="flex-1 h-full bg-dark-900 overflow-y-auto flex flex-col select-none">
      {/* Top Action Bar */}
      <div className="px-6 py-3.5 bg-dark-800/80 border-b border-dark-700 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-sm rounded-lg">
            {scene.shot_id}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Сцена {scene.id} • Кадров в этой сцене: <strong className="text-slate-200">{images.length}</strong>
          </span>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBatchAudio}
            disabled={isBatchAudioLoading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            title="Сгенерировать озвучку для всех не озвученных реплик"
          >
            <Mic className={`w-3.5 h-3.5 ${isBatchAudioLoading ? 'animate-bounce' : ''}`} />
            <span>{isBatchAudioLoading ? 'Озвучивание всех...' : 'Озвучить всё (Chatterbox Turbo)'}</span>
          </button>

          {batchProgress?.isRunning ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-semibold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                <span>
                  {batchProgress.label || `Генерация [${batchProgress.current}/${batchProgress.total}]...`}
                </span>
              </div>
              {onStopBatchImages && (
                <button
                  onClick={onStopBatchImages}
                  className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-1"
                  title="Остановить пакетную генерацию"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Стоп</span>
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={onBatchImages}
              disabled={isBatchImagesLoading}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              title="Запустить браузер Gemini для генерации всех недостающих кадров"
            >
              <ImageIcon className={`w-3.5 h-3.5 ${isBatchImagesLoading ? 'animate-bounce' : ''}`} />
              <span>{isBatchImagesLoading ? 'Генерация всех в Gemini...' : 'Сгенерить все картинки (Gemini)'}</span>
            </button>
          )}

          <div className="h-4 w-px bg-dark-600 mx-1" />

          {/* Prev / Next Scene Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevScene}
              disabled={!hasPrev}
              className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 disabled:opacity-30 text-slate-200 transition"
              title="Предыдущая сцена"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNextScene}
              disabled={!hasNext}
              className="p-1.5 rounded-lg bg-dark-700 hover:bg-dark-600 disabled:opacity-30 text-slate-200 transition"
              title="Следующая сцена"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Inspector Body */}
      <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto w-full">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Voiceover Section */}
        <div className="bg-dark-800 border border-dark-700 rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <Mic className="w-4 h-4 text-emerald-400" />
              <span>1. Текст реплики сцены</span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                scene.audio_status === 'ready'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-dark-700 text-slate-400'
              }`}
            >
              {scene.audio_status === 'ready' ? 'Озвучка готова' : 'Ожидает озвучки'}
            </span>
          </div>

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onUpdateScene({ ...scene, text: e.target.value });
            }}
            rows={2}
            placeholder="Текст реплики для озвучки..."
            className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none leading-relaxed select-text"
          />

          {/* Audio Player & Gen Button */}
          <div className="flex items-center justify-between bg-dark-900/60 p-3 rounded-xl border border-dark-700">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayAudio}
                disabled={!scene.audio_file}
                className={`p-2.5 rounded-xl transition ${
                  scene.audio_file
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-dark-900 shadow-md'
                    : 'bg-dark-700 text-slate-500 cursor-not-allowed'
                }`}
                title={isPlaying ? 'Пауза' : 'Слушать реплику'}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">
                  {scene.audio_file ? 'Аудио дорожка готова' : 'Аудио еще не создано'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {scene.audio_duration ? `Длительность: ${scene.audio_duration.toFixed(2)}s` : 'Нажмите "Озвучить"'}
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateAudio}
              disabled={audioLoading || !text.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${audioLoading ? 'animate-spin' : ''}`} />
              <span>{audioLoading ? 'Озвучивание...' : 'Озвучить'}</span>
            </button>
          </div>
        </div>

        {/* 2. Collection of Images for this Scene */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
              <ImageIcon className="w-4 h-4 text-blue-400" />
              <span>2. Кадры и анимации сцены ({images.length})</span>
            </div>
            <button
              onClick={handleAddImage}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить кадр</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {images.map((img, idx) => {
              const isReady = img.status === 'ready' && !!img.image_file;
              const imgUrl = isReady ? `${api.getMediaUrl(projectId, img.image_file)}?v=${imageVersion}` : null;
              const isGenerating = generatingImageId === img.id || isBatchImagesLoading || img.status === 'generating';

              return (
                <div
                  key={`${img.id}_${imageVersion}`}
                  className="bg-dark-800 border border-dark-700 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-sm group hover:border-dark-600 transition"
                >
                  <div className="flex flex-col gap-3">
                    {/* Header: Cut timing badge & delete */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono font-bold text-xs flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {img.start_time.toFixed(1)}s
                        </span>
                        <span className="text-xs font-semibold text-slate-300">
                          Кадр #{idx + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedImageForVersions(img)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-dark-750 hover:bg-dark-700 border border-dark-650 text-slate-300 text-[10px] font-semibold transition"
                          title="История версий этого кадра"
                        >
                          <Layers className="w-3 h-3 text-amber-400" />
                          <span>Версии ({img.variants?.length || (isReady ? 1 : 0)})</span>
                        </button>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            img.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : img.status === 'generating'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : img.status === 'error'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : 'bg-dark-700 text-slate-400'
                          }`}
                        >
                          {img.status === 'ready'
                            ? 'Готово'
                            : img.status === 'generating'
                            ? 'Генерация...'
                            : img.status === 'error'
                            ? 'Ошибка'
                            : 'Ожидает'}
                        </span>

                        {images.length > 1 && (
                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-dark-700 rounded-lg transition"
                            title="Удалить этот суб-кадр"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 16:9 or 9:16 Image or Video Preview */}
                    <div className={`w-full bg-dark-950 rounded-xl border border-dark-700 flex items-center justify-center overflow-hidden relative ${
                      aspectRatio === '9:16' ? 'aspect-[9/16] max-w-[280px] mx-auto shadow-md' : 'aspect-video'
                    }`}>
                      {isGenerating ? (
                        <div className="flex flex-col items-center gap-2 text-blue-400">
                          <RefreshCw className="w-7 h-7 animate-spin" />
                          <span className="text-xs font-semibold">Генерация кадра через Gemini...</span>
                        </div>
                      ) : imgUrl ? (
                        /\.(mp4|webm|mov|mkv)$/i.test(img.image_file || '') ? (
                          <div className="relative w-full h-full">
                            <video
                              src={imgUrl}
                              controls
                              loop
                              autoPlay
                              muted
                              className="w-full h-full object-contain bg-black"
                            />
                            <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-600/90 text-white font-bold text-[10px] rounded-md shadow flex items-center gap-1 backdrop-blur-sm pointer-events-none">
                              <Video className="w-3 h-3" />
                              MP4 Анимация
                            </span>
                          </div>
                        ) : (
                          <div className="relative w-full h-full">
                            <img
                              src={imgUrl}
                              alt={img.id}
                              className="w-full h-full object-contain bg-white"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )
                      ) : img.status === 'error' ? (
                        <div className="flex flex-col items-center gap-1.5 text-red-400 p-4 text-center">
                          <AlertTriangle className="w-7 h-7" />
                          <span className="text-xs font-semibold">Ошибка генерации</span>
                          <span className="text-[10px] text-slate-400">Попробуйте сгенерировать снова</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-600 p-4 text-center">
                          <ImageIcon className="w-8 h-8 stroke-[1.2]" />
                          <span className="text-[11px]">Кадр не сгенерирован</span>
                        </div>
                      )}
                    </div>

                    {/* Style Selector & Prompt Editor */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <Palette className="w-3 h-3 text-amber-400" />
                          <span>Стиль кадра:</span>
                        </label>

                        <select
                          value={img.style || 'storytime_2d'}
                          onChange={(e) => handleImageStyleChange(img.id, e.target.value)}
                          className="bg-dark-900 border border-dark-700 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          {AVAILABLE_STYLES.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.emoji} {st.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        value={img.prompt}
                        onChange={(e) => handleImagePromptChange(img.id, e.target.value)}
                        rows={3}
                        placeholder="ИИ-Промпт кадра..."
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 transition resize-none select-text leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Action Buttons: Generate with Gemini OR Upload MP4 video */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGenerateSingleImage(img.id, img.prompt)}
                      disabled={isGenerating || !img.prompt.trim()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Генерация в браузере...' : 'Сгенерить кадр'}</span>
                    </button>

                    <label
                      className={`px-3 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        uploadingImageId === img.id ? 'opacity-50 cursor-wait' : ''
                      }`}
                      title="Загрузить готовое видео или анимацию (.mp4, .webm)"
                    >
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                        className="hidden"
                        disabled={uploadingImageId === img.id}
                        onChange={(e) => handleVideoUpload(img.id, e)}
                      />
                      <Upload className={`w-3.5 h-3.5 ${uploadingImageId === img.id ? 'animate-bounce' : ''}`} />
                      <span>{uploadingImageId === img.id ? 'Загрузка...' : 'MP4'}</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Frame Versions Modal */}
      <ImageVersionsModal
        isOpen={!!selectedImageForVersions}
        onClose={() => setSelectedImageForVersions(null)}
        projectId={projectId}
        sceneId={scene.id}
        shotId={scene.shot_id}
        image={selectedImageForVersions}
        onVariantSelected={handleVariantUpdated}
      />
    </main>
  );
};
