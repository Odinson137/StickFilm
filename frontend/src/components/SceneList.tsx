import React, { useState } from 'react';
import { Scene } from '../types';
import { Search, Mic, Image as ImageIcon, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

interface Props {
  scenes: Scene[];
  activeSceneId: number | null;
  onSelectScene: (id: number) => void;
}

export const SceneList: React.FC<Props> = ({ scenes, activeSceneId, onSelectScene }) => {
  const [search, setSearch] = useState<string>('');

  const filteredScenes = scenes.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.shot_id.toLowerCase().includes(q) ||
      s.text.toLowerCase().includes(q) ||
      (s.desc && s.desc.toLowerCase().includes(q))
    );
  });

  const readyAudioCount = scenes.filter((s) => s.audio_status === 'ready').length;
  const readyImageCount = scenes.filter((s) => s.image_status === 'ready').length;

  return (
    <aside className="w-80 h-full bg-dark-800 border-r border-dark-700 flex flex-col flex-shrink-0 select-none">
      {/* Search & Stats Bar */}
      <div className="p-4 border-b border-dark-700 flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по репликам..."
            className="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        {/* Counters */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span>Сцен: <strong className="text-slate-200">{scenes.length}</strong></span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-emerald-400">
              <Mic className="w-3 h-3" /> {readyAudioCount}/{scenes.length}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-blue-400">
              <ImageIcon className="w-3 h-3" /> {readyImageCount}/{scenes.length}
            </span>
          </div>
        </div>
      </div>

      {/* Scenes Scroll List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {filteredScenes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {scenes.length === 0
              ? 'Нет реплик. Нажмите "Импорт сценария" для загрузки.'
              : 'Ничего не найдено.'}
          </div>
        ) : (
          filteredScenes.map((scene) => {
            const isActive = scene.id === activeSceneId;
            return (
              <div
                key={scene.id}
                onClick={() => onSelectScene(scene.id)}
                className={`p-3 rounded-xl border cursor-pointer transition flex flex-col gap-1.5 ${
                  isActive
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-sm text-slate-100'
                    : 'bg-dark-900/40 border-dark-700/60 hover:bg-dark-900 hover:border-dark-600 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono font-bold ${isActive ? 'text-amber-400' : 'text-slate-400'}`}>
                      {scene.shot_id}
                    </span>
                    {scene.audio_duration ? (
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {scene.audio_duration.toFixed(1)}s
                      </span>
                    ) : null}
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-1.5">
                    {/* Audio Status */}
                    <div
                      title={`Озвучка: ${scene.audio_status}`}
                      className={`p-1 rounded-md text-[10px] ${
                        scene.audio_status === 'ready'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : scene.audio_status === 'generating'
                          ? 'bg-amber-500/15 text-amber-400 animate-pulse'
                          : scene.audio_status === 'error'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-dark-700 text-slate-500'
                      }`}
                    >
                      <Mic className="w-3 h-3" />
                    </div>

                    {/* Image Status */}
                    <div
                      title={`Кадр: ${scene.image_status}`}
                      className={`p-1 rounded-md text-[10px] ${
                        scene.image_status === 'ready'
                          ? 'bg-blue-500/15 text-blue-400'
                          : scene.image_status === 'generating'
                          ? 'bg-amber-500/15 text-amber-400 animate-pulse'
                          : scene.image_status === 'error'
                          ? 'bg-red-500/15 text-red-400'
                          : 'bg-dark-700 text-slate-500'
                      }`}
                    >
                      <ImageIcon className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {scene.text || <span className="italic text-slate-600">Пустая реплика</span>}
                </p>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
