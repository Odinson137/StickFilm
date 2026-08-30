import React, { useState } from 'react';
import { X, Play, Image as ImageIcon, Volume2, Save, Scissors, LayoutList, CheckCircle } from 'lucide-react';
import { Project } from '../types';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
}

export const ShortsGeneratorModal: React.FC<Props> = ({ isOpen, onClose, project }) => {
  const [chunks, setChunks] = useState<any[]>([]);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());
  const [selectedSpeed, setSelectedSpeed] = useState<number>(project.settings?.speed || 1.0);

  // Load existing plan on open
  React.useEffect(() => {
    if (isOpen) {
      loadPlan(false);
    }
  }, [isOpen]);

  const loadPlan = async (force: boolean) => {
    setIsLoadingPlan(true);
    try {
      const data = await api.getShortsPlan(project.id, selectedSpeed, force);
      setChunks(data.chunks);
    } catch (e: any) {
      console.error(e);
      const detail = e.response?.data?.detail || e.message;
      alert(`Ошибка при загрузке или расчёте плана: ${detail}`);
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const savePlan = async (newChunks: any[]) => {
    try {
      await api.saveShortsPlan(project.id, newChunks, selectedSpeed);
    } catch (e) {
      console.error('Failed to save plan', e);
    }
  };

  if (!isOpen) return null;

  const handleGenerateImage = async (chunkIdx: number, type: 'intro' | 'outro') => {
    const chunk = chunks[chunkIdx];
    const bumper = chunk[type];
    
    setChunks(prev => {
      const newChunks = [...prev];
      newChunks[chunkIdx][type].is_generating_image = true;
      return newChunks;
    });

    try {
      const outName = `${type}_${chunkIdx}.png`;
      const isVertical = project.settings?.aspect_ratio !== '16:9';
      await api.generateBumperImage(project.id, bumper.image_prompt, outName, isVertical);
      
      setChunks(prev => {
        const newChunks = [...prev];
        newChunks[chunkIdx][type].image_file = outName;
        newChunks[chunkIdx][type].is_generating_image = false;
        savePlan(newChunks);
        return newChunks;
      });
      setCacheBuster(Date.now());
    } catch (e) {
      console.error(e);
      setChunks(prev => {
        const newChunks = [...prev];
        newChunks[chunkIdx][type].is_generating_image = false;
        return newChunks;
      });
      alert('Ошибка при генерации картинки');
    }
  };

  const handleGenerateAudio = async (chunkIdx: number, type: 'intro' | 'outro') => {
    const chunk = chunks[chunkIdx];
    const bumper = chunk[type];
    
    setChunks(prev => {
      const newChunks = [...prev];
      newChunks[chunkIdx][type].is_generating_audio = true;
      return newChunks;
    });

    try {
      const outName = `${type}_${chunkIdx}.wav`;
      await api.generateBumperAudio(project.id, bumper.voice_text, outName);
      
      setChunks(prev => {
        const newChunks = [...prev];
        newChunks[chunkIdx][type].audio_file = outName;
        newChunks[chunkIdx][type].is_generating_audio = false;
        savePlan(newChunks);
        return newChunks;
      });
      setCacheBuster(Date.now());
    } catch (e) {
      console.error(e);
      setChunks(prev => {
        const newChunks = [...prev];
        newChunks[chunkIdx][type].is_generating_audio = false;
        return newChunks;
      });
      alert('Ошибка при генерации аудио');
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i].intro.image_file || !chunks[i].intro.audio_file || !chunks[i].outro.image_file || !chunks[i].outro.audio_file) {
        // Try generating one by one (to not overload limits, but we could do parallel)
        await handleGenerateImage(i, 'intro');
        await handleGenerateAudio(i, 'intro');
        await handleGenerateImage(i, 'outro');
        await handleGenerateAudio(i, 'outro');
      }
    }
    setIsGeneratingAll(false);
  };

  const updateBumperField = (chunkIdx: number, type: 'intro' | 'outro', field: string, value: string) => {
    setChunks(prev => {
      const newChunks = [...prev];
      newChunks[chunkIdx][type][field] = value;
      return newChunks;
    });
  };

  // We can save plan on blur of inputs
  const handleInputBlur = () => {
    savePlan(chunks);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-700 bg-dark-800 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center text-pink-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Генератор Shorts & TikTok</h2>
              <p className="text-xs text-slate-400">Ручная настройка интро и аутро для каждой части</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded-xl transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-dark-950">
          
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <LayoutList className="w-16 h-16 text-dark-700 mb-4" />
              <h3 className="text-lg font-semibold text-slate-300 mb-2">Видео пока не разрезано</h3>
              <p className="text-sm text-slate-500 max-w-md mb-6">
                Нажмите кнопку ниже, чтобы алгоритм проанализировал таймлайн и разбил видео на оптимальные смысловые куски (до 1 минуты каждый), строго по границам сцен.
              </p>
              <button
                onClick={() => loadPlan(true)}
                disabled={isLoadingPlan}
                className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl shadow-lg shadow-pink-600/20 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isLoadingPlan ? 'Расчёт...' : 'Рассчитать разделители'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className="flex items-center justify-between bg-dark-800 p-4 rounded-xl border border-dark-700">
                <div>
                  <h3 className="font-bold text-slate-200">Видео разделено на {chunks.length} частей</h3>
                  <p className="text-xs text-slate-400">Теперь вы можете настроить заставки для каждого куска</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 mr-4">
                    <label className="text-sm font-semibold text-slate-400">Скорость:</label>
                    <select
                      value={selectedSpeed}
                      onChange={(e) => setSelectedSpeed(Number(e.target.value))}
                      className="bg-dark-900 border border-dark-600 rounded-lg px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-pink-500 transition"
                    >
                      <option value={1.0}>1.0x (Обычная)</option>
                      <option value={1.1}>1.1x</option>
                      <option value={1.2}>1.2x (Shorts)</option>
                      <option value={1.3}>1.3x</option>
                    </select>
                  </div>
                  <button
                    onClick={() => loadPlan(true)}
                    disabled={isLoadingPlan || isGeneratingAll}
                    className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-200 text-sm font-semibold rounded-lg transition"
                  >
                    Пересчитать заново
                  </button>
                  <button
                    onClick={handleGenerateAll}
                    disabled={isGeneratingAll || isLoadingPlan}
                    className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-pink-600/20 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {isGeneratingAll ? 'Генерация...' : 'Сгенерировать всё'}
                  </button>
                </div>
              </div>

              {chunks.map((chunk, idx) => (
                <div key={idx} className="bg-dark-900 border border-dark-700 rounded-2xl overflow-hidden">
                  <div className="bg-dark-800 px-5 py-3 border-b border-dark-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-400 font-bold flex items-center justify-center text-sm">
                        {idx + 1}
                      </span>
                      <h4 className="font-bold text-slate-200">Часть {idx + 1}</h4>
                      {chunk.included_scenes && (
                        <span className="text-xs text-slate-400 ml-2">
                          (Сцены: {chunk.included_scenes.join(', ')})
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 bg-dark-950 px-2 py-1 rounded-md">
                      Длительность основы: {chunk.duration.toFixed(1)} сек.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 divide-x divide-dark-700">
                    {/* Intro Column */}
                    <div className="p-5 flex flex-col gap-4">
                      <h5 className="font-bold text-emerald-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <Play className="w-4 h-4" /> Интро (Начало)
                      </h5>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Промпт картинки</label>
                        <textarea
                          value={chunk.intro.image_prompt}
                          onChange={(e) => updateBumperField(idx, 'intro', 'image_prompt', e.target.value)}
                          onBlur={handleInputBlur}
                          className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition h-28 resize-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Текст озвучки (Шёпот)</label>
                        <input
                          value={chunk.intro.voice_text}
                          onChange={(e) => updateBumperField(idx, 'intro', 'voice_text', e.target.value)}
                          onBlur={handleInputBlur}
                          className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition"
                        />
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleGenerateImage(idx, 'intro')}
                          disabled={chunk.intro.is_generating_image}
                          className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 border border-dark-600 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          {chunk.intro.is_generating_image ? 'Рисуем...' : 'Картинка'}
                        </button>
                        <button
                          onClick={() => handleGenerateAudio(idx, 'intro')}
                          disabled={chunk.intro.is_generating_audio}
                          className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 border border-dark-600 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          {chunk.intro.is_generating_audio ? 'Генерация...' : 'Аудио'}
                        </button>
                      </div>

                      {/* Previews */}
                      {(chunk.intro.image_file || chunk.intro.audio_file) && (
                        <div className="mt-2 bg-dark-950 rounded-xl border border-dark-700 overflow-hidden flex flex-col">
                          {chunk.intro.image_file && (
                            <img 
                              src={api.getMediaUrl(project.id, `output/${chunk.intro.image_file}`, cacheBuster)} 
                              alt="Intro" 
                              className="w-full h-32 object-contain bg-black"
                            />
                          )}
                          {chunk.intro.audio_file && (
                            <div className="p-2 border-t border-dark-700 bg-dark-900">
                              <audio 
                                src={api.getMediaUrl(project.id, `output/${chunk.intro.audio_file}`, cacheBuster)} 
                                controls 
                                className="w-full h-8"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Outro Column */}
                    <div className="p-5 flex flex-col gap-4">
                      <h5 className="font-bold text-amber-400 flex items-center gap-2 text-sm uppercase tracking-wider">
                        <X className="w-4 h-4" /> Аутро (Конец)
                      </h5>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Промпт картинки</label>
                        <textarea
                          value={chunk.outro.image_prompt}
                          onChange={(e) => updateBumperField(idx, 'outro', 'image_prompt', e.target.value)}
                          onBlur={handleInputBlur}
                          className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition h-28 resize-none"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Текст озвучки (Шёпот)</label>
                        <input
                          value={chunk.outro.voice_text}
                          onChange={(e) => updateBumperField(idx, 'outro', 'voice_text', e.target.value)}
                          onBlur={handleInputBlur}
                          className="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
                        />
                      </div>

                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleGenerateImage(idx, 'outro')}
                          disabled={chunk.outro.is_generating_image}
                          className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 border border-dark-600 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          {chunk.outro.is_generating_image ? 'Рисуем...' : 'Картинка'}
                        </button>
                        <button
                          onClick={() => handleGenerateAudio(idx, 'outro')}
                          disabled={chunk.outro.is_generating_audio}
                          className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 text-slate-300 border border-dark-600 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          {chunk.outro.is_generating_audio ? 'Генерация...' : 'Аудио'}
                        </button>
                      </div>

                      {/* Previews */}
                      {(chunk.outro.image_file || chunk.outro.audio_file) && (
                        <div className="mt-2 bg-dark-950 rounded-xl border border-dark-700 overflow-hidden flex flex-col">
                          {chunk.outro.image_file && (
                            <img 
                              src={api.getMediaUrl(project.id, `output/${chunk.outro.image_file}`, cacheBuster)} 
                              alt="Outro" 
                              className="w-full h-32 object-contain bg-black"
                            />
                          )}
                          {chunk.outro.audio_file && (
                            <div className="p-2 border-t border-dark-700 bg-dark-900">
                              <audio 
                                src={api.getMediaUrl(project.id, `output/${chunk.outro.audio_file}`, cacheBuster)} 
                                controls 
                                className="w-full h-8"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
