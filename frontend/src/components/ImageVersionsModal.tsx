import React, { useState, useEffect } from 'react';
import { SceneImage, ImageVariant } from '../types';
import { api } from '../services/api';
import { X, Check, Trash2, Clock, Video, Image as ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  sceneId: number;
  shotId: string;
  image: SceneImage | null;
  onVariantSelected: () => void;
}

export const ImageVersionsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  projectId,
  sceneId,
  shotId,
  image,
  onVariantSelected,
}) => {
  const [variants, setVariants] = useState<ImageVariant[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [cacheKey, setCacheKey] = useState<number>(Date.now());
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  const loadVariants = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const res = await api.getImageVariants(projectId, sceneId, image.id);
      setVariants(res.variants || []);
      setActiveFile(res.active_file || image.image_file || null);
      setCacheKey(Date.now());
    } catch (err) {
      console.error('Failed to load variants:', err);
      // Fallback to image.variants
      setVariants(image.variants || []);
      setActiveFile(image.image_file || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && image) {
      setBrokenImages(new Set());
      loadVariants();
    }
  }, [isOpen, image?.id, image?.image_file]);

  if (!isOpen || !image) return null;

  const handleSelect = async (variantFile: string) => {
    try {
      await api.selectImageVariant(projectId, sceneId, image.id, variantFile);
      setActiveFile(variantFile);
      onVariantSelected();
      onClose();
    } catch (err) {
      console.error('Failed to select variant:', err);
    }
  };

  const handleDelete = async (variantFile: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteImageVariant(projectId, sceneId, image.id, variantFile);
      await loadVariants();
      onVariantSelected();
    } catch (err) {
      console.error('Failed to delete variant:', err);
    }
  };

  // Display newest variants first
  const reversedVariants = [...variants].reverse();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-dark-700 flex items-center justify-between bg-dark-850">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs rounded-lg">
              {shotId} ({image.id})
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                История версий кадра
              </h3>
              <p className="text-xs text-slate-400">
                Всего сохранено версий: <strong className="text-slate-200">{variants.length}</strong>. Нажмите на нужную версию, чтобы сделать её активной.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadVariants}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded-xl transition"
              title="Обновить список версий"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Grid of Variants */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading && variants.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
              <span>Загрузка истории версий...</span>
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm flex flex-col items-center gap-2">
              <ImageIcon className="w-10 h-10 stroke-[1.2]" />
              <span>Для этого кадра пока нет сохраненных версий.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {reversedVariants.map((v, idx) => {
                const isActive = activeFile === v.file;
                const isVideo = /\.(mp4|webm|mov|mkv)$/i.test(v.file);
                const mediaUrl = api.getMediaUrl(projectId, v.file, cacheKey);
                const isBroken = brokenImages.has(v.file);

                return (
                  <div
                    key={`${v.file}_${idx}`}
                    onClick={() => !isActive && handleSelect(v.file)}
                    className={`bg-dark-800 border rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition cursor-pointer ${
                      isActive
                        ? 'border-emerald-500/80 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-950/40 bg-dark-800'
                        : 'border-dark-700 hover:border-blue-500/50 hover:bg-dark-750'
                    }`}
                  >
                    <div className="flex flex-col gap-2.5">
                      {/* Top Bar of Variant Card */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          {isVideo ? (
                            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-md font-mono text-[11px] flex items-center gap-1">
                              <Video className="w-3 h-3" /> MP4
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md font-mono text-[11px]">
                              PNG
                            </span>
                          )}
                          Версия #{reversedVariants.length - idx}
                        </span>

                        <div className="flex items-center gap-2">
                          {v.created_at && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {v.created_at}
                            </span>
                          )}
                          {variants.length > 1 && !isActive && (
                            <button
                              onClick={(e) => handleDelete(v.file, e)}
                              className="p-1 text-slate-500 hover:text-red-400 hover:bg-dark-700 rounded-lg transition"
                              title="Удалить эту версию"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 16:9 Media Preview */}
                      <div className="w-full aspect-video bg-dark-950 rounded-xl border border-dark-700 overflow-hidden relative flex items-center justify-center">
                        {isBroken ? (
                          <div className="flex flex-col items-center justify-center text-slate-500 gap-1 p-4 text-center">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                            <span className="text-[11px]">Файл не найден на диске</span>
                          </div>
                        ) : isVideo ? (
                          <video
                            src={mediaUrl}
                            controls
                            loop
                            muted
                            className="w-full h-full object-contain bg-black"
                            onError={() => setBrokenImages((prev) => new Set(prev).add(v.file))}
                          />
                        ) : (
                          <img
                            src={mediaUrl}
                            alt={`Variant ${idx}`}
                            className="w-full h-full object-contain bg-white"
                            onError={() => setBrokenImages((prev) => new Set(prev).add(v.file))}
                          />
                        )}
                        {isActive && (
                          <span className="absolute top-2 right-2 px-2.5 py-1 bg-emerald-600 text-white font-bold text-[10px] rounded-lg shadow-md flex items-center gap-1">
                            <Check className="w-3 h-3" /> Выбранный вариант
                          </span>
                        )}
                      </div>

                      {/* Prompt used for this version */}
                      {v.prompt && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 bg-dark-900/60 p-2 rounded-lg border border-dark-700/50">
                          <strong className="text-slate-300">Промпт:</strong> {v.prompt}
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    <div>
                      {isActive ? (
                        <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center font-bold text-xs rounded-xl flex items-center justify-center gap-1.5">
                          <Check className="w-4 h-4" />
                          <span>Активен в проекте</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSelect(v.file)}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                        >
                          <span>Выбрать этот вариант</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-dark-700 bg-dark-850 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-dark-700 hover:bg-dark-600 text-slate-200 font-semibold text-xs rounded-xl transition"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
