import React from 'react';
import { Film, Save, Sparkles, FileText, Key, Video, FolderOpen, Check, Image as ImageIcon, Settings } from 'lucide-react';
import { Project } from '../types';

interface Props {
  project: Project | null;
  onSave: () => void;
  isSaving: boolean;
  onToggleAspectRatio?: (aspectRatio: '16:9' | '9:16') => void;
  onOpenMasterPrompt: () => void;
  onOpenImporter: () => void;
  onOpenTokens: () => void;
  onOpenStudio: () => void;
  onOpenThumbnails: () => void;
  onOpenProjectManager: () => void;
  onOpenShortsGenerator: () => void;
  onOpenProjectSettings: () => void;
}

export const Header: React.FC<Props> = ({
  project,
  onSave,
  isSaving,
  onToggleAspectRatio,
  onOpenMasterPrompt,
  onOpenImporter,
  onOpenTokens,
  onOpenStudio,
  onOpenThumbnails,
  onOpenProjectManager,
  onOpenShortsGenerator,
  onOpenProjectSettings,
}) => {
  const currentRatio = project?.settings?.aspect_ratio || '16:9';

  return (
    <header className="h-16 bg-dark-800 border-b border-dark-700 px-6 flex items-center justify-between select-none z-30 flex-shrink-0">
      {/* Brand Logo & Current Project Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-dark-900 font-extrabold shadow-lg shadow-amber-500/20">
            <Film className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-slate-100 flex items-center gap-1.5">
              <span>Stickfilm</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                Studio
              </span>
            </h1>
          </div>
        </div>

        <div className="h-5 w-px bg-dark-700" />

        {/* Project Selector Trigger */}
        <button
          onClick={onOpenProjectManager}
          className="flex items-center gap-2 px-3 py-1.5 bg-dark-900 hover:bg-dark-950 border border-dark-700 hover:border-dark-600 rounded-xl text-xs text-slate-200 font-semibold transition"
          title="Открыть менеджер проектов"
        >
          <FolderOpen className="w-4 h-4 text-amber-400" />
          <span className="max-w-[140px] truncate">{project ? project.title : 'Выберите проект'}</span>
        </button>

        {/* Aspect Ratio Format Switcher */}
        {project && (
          <div className="flex items-center bg-dark-900 border border-dark-700 rounded-xl p-0.5 shadow-inner">
            <button
              onClick={() => onToggleAspectRatio && onToggleAspectRatio('16:9')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentRatio === '16:9'
                  ? 'bg-amber-500 text-dark-900 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Горизонтальный формат 16:9 (YouTube)"
            >
              <span>16:9</span>
            </button>
            <button
              onClick={() => onToggleAspectRatio && onToggleAspectRatio('9:16')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                currentRatio === '9:16'
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Вертикальный формат 9:16 (YouTube Shorts, TikTok, Reels)"
            >
              <span>9:16 Shorts</span>
            </button>
          </div>
        )}
      </div>

      {/* Center Actions: Script & Thumbnails */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMasterPrompt}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-dark-700/60 hover:bg-dark-700 text-amber-400 hover:text-amber-300 border border-dark-600 rounded-xl text-xs font-semibold transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>1. Промпт для Claude</span>
        </button>

        <button
          onClick={onOpenImporter}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-dark-700/60 hover:bg-dark-700 text-blue-400 hover:text-blue-300 border border-dark-600 rounded-xl text-xs font-semibold transition"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>2. Импорт сценария</span>
        </button>

        <button
          onClick={onOpenThumbnails}
          disabled={!project}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-purple-200 border border-purple-500/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>3. Превью для YouTube (3 шт)</span>
        </button>

        <button
          onClick={onOpenShortsGenerator}
          disabled={!project}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 hover:text-pink-200 border border-pink-500/30 rounded-xl text-xs font-semibold transition disabled:opacity-50"
        >
          <Video className="w-3.5 h-3.5" />
          <span>4. Нарезка на Shorts (TikTok)</span>
        </button>
      </div>

      {/* Right Controls: Save, Settings, Video Studio */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenProjectSettings}
          disabled={!project}
          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-dark-700/60 rounded-xl border border-transparent hover:border-dark-600 transition disabled:opacity-40"
          title="Настройки проекта (Субтитры, Музыка BGM, Паспорт фильма)"
        >
          <Settings className="w-4 h-4 text-amber-400" />
        </button>


        <button
          onClick={onSave}
          disabled={isSaving || !project}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-dark-700 hover:bg-dark-600 text-slate-200 border border-dark-600 rounded-xl text-xs font-semibold transition disabled:opacity-50"
        >
          {isSaving ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Save className="w-3.5 h-3.5" />}
          <span>{isSaving ? 'Сохранено!' : 'Сохранить'}</span>
        </button>

        <button
          onClick={onOpenStudio}
          disabled={!project}
          className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-dark-900 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95 disabled:opacity-50"
        >
          <Video className="w-4 h-4 fill-current" />
          <span>Видео Студия</span>
        </button>
      </div>
    </header>
  );
};
