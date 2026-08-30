import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Download, RefreshCw, Sparkles, Check, AlertCircle, Copy } from 'lucide-react';
import { api } from '../services/api';
import { ProjectThumbnails, ThumbnailOption } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  aspectRatio?: string;
}

export const ThumbnailModal: React.FC<Props> = ({ isOpen, onClose, projectId, aspectRatio = "16:9" }) => {
  const isVertical = aspectRatio === "9:16" || aspectRatio === "vertical";
  const [thumbnailsData, setThumbnailsData] = useState<ProjectThumbnails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [refreshingPrompts, setRefreshingPrompts] = useState<boolean>(false);

  const fetchThumbnails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getThumbnails(projectId);
      setThumbnailsData(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки превью');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrompts = async () => {
    setRefreshingPrompts(true);
    setError(null);
    try {
      const data = await api.refreshThumbnailPrompts(projectId);
      setThumbnailsData(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setRefreshingPrompts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchThumbnails();
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleGenerateSingle = async (thumbId: string, prompt: string) => {
    setGeneratingId(thumbId);
    setError(null);
    try {
      await api.generateThumbnail(projectId, thumbId, prompt);
      await fetchThumbnails();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    setError(null);
    try {
      await api.generateAllThumbnails(projectId);
      await fetchThumbnails();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setGeneratingAll(false);
    }
  };

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePromptChange = (id: string, newPrompt: string) => {
    if (!thumbnailsData) return;
    const updated = thumbnailsData.thumbnails.map((t) => (t.id === id ? { ...t, prompt: newPrompt } : t));
    setThumbnailsData({ ...thumbnailsData, thumbnails: updated });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Генератор Превью для YouTube (3 Варианта)</h3>
              <p className="text-xs text-slate-400">Передает весь сценарий в Gemini и находит 3 разных ключевых кадра (Мем, Экшен, Финал)</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRefreshPrompts}
              disabled={refreshingPrompts || generatingAll || generatingId !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-dark-700 hover:bg-dark-600 border border-dark-600 hover:border-amber-500/40 text-slate-200 text-xs font-semibold rounded-xl shadow transition"
              title="Пересоздать 3 промпта по актуальному сценарию фильма"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${refreshingPrompts ? 'animate-spin' : ''}`} />
              <span>{refreshingPrompts ? 'Анализ...' : 'Обновить по сценарию'}</span>
            </button>

            <button
              onClick={handleGenerateAll}
              disabled={generatingAll || generatingId !== null}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-dark-900 font-bold text-xs rounded-xl shadow-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generatingAll ? 'animate-spin' : ''}`} />
              <span>{generatingAll ? 'Генерация всех...' : 'Сгенерить все 3 превью'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-dark-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !thumbnailsData ? (
            <div className="py-16 text-center text-xs text-slate-400">Загрузка вариантов превью...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {thumbnailsData?.thumbnails.map((thumb) => {
                const imgUrl = thumb.image_file ? api.getMediaUrl(projectId, thumb.image_file) : null;
                const isGenerating = generatingId === thumb.id || generatingAll;

                return (
                  <div
                    key={thumb.id}
                    className="bg-dark-900 border border-dark-700 rounded-2xl p-4 flex flex-col justify-between gap-4 shadow-md group"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Title & Status */}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">{thumb.title}</span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            thumb.status === 'ready'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-dark-700 text-slate-400'
                          }`}
                        >
                          {thumb.status === 'ready' ? 'Готово' : 'Ожидает'}
                        </span>
                      </div>

                      {/* Thumbnail Image Canvas */}
                      <div className={`w-full ${isVertical ? 'aspect-[9/16] max-h-72 mx-auto' : 'aspect-video'} bg-dark-950 rounded-xl border border-dark-700 flex items-center justify-center overflow-hidden relative`}>
                        {imgUrl && thumb.status === 'ready' ? (
                          <img
                            src={imgUrl}
                            alt={thumb.title}
                            className="w-full h-full object-contain bg-white"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-slate-600">
                            <ImageIcon className="w-8 h-8 stroke-[1.2]" />
                            <span className="text-[11px]">{isVertical ? '9:16 Вертикальная обложка' : '16:9 Обложка'}</span>
                          </div>
                        )}

                        {imgUrl && thumb.status === 'ready' && (
                          <a
                            href={imgUrl}
                            download={`thumbnail_${thumb.id}.png`}
                            className="absolute top-2 right-2 p-2 bg-dark-900/80 hover:bg-dark-900 text-slate-200 hover:text-emerald-400 rounded-lg shadow-lg border border-dark-700 transition"
                            title={isVertical ? "Скачать обложку 9:16" : "Скачать обложку 16:9"}
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      {/* Prompt Editor */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-400">ИИ-Промпт обложки:</label>
                          <button
                            onClick={() => handleCopyPrompt(thumb.id, thumb.prompt)}
                            className="text-[10px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition"
                          >
                            {copiedId === thumb.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === thumb.id ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        </div>
                        <textarea
                          value={thumb.prompt}
                          onChange={(e) => handlePromptChange(thumb.id, e.target.value)}
                          rows={4}
                          className="w-full bg-dark-950 border border-dark-700 rounded-xl p-2.5 text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none leading-relaxed select-text"
                        />
                      </div>
                    </div>

                    {/* Single Generate Button */}
                    <button
                      onClick={() => handleGenerateSingle(thumb.id, thumb.prompt)}
                      disabled={isGenerating || !thumb.prompt.trim()}
                      className="w-full py-2.5 bg-dark-700 hover:bg-amber-500 hover:text-dark-900 text-slate-200 disabled:opacity-50 font-semibold text-xs rounded-xl border border-dark-600 hover:border-amber-400 shadow transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Генерация в Gemini...' : 'Сгенерить эту обложку'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-dark-700 bg-dark-800/80 rounded-b-2xl">
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
