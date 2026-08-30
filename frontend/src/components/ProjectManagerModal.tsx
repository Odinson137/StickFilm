import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Plus, Trash2, Film, Clock } from 'lucide-react';
import { api } from '../services/api';
import { ProjectListItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  onSelectProject: (id: string) => void;
  onProjectCreated: (id: string) => void;
}

export const ProjectManagerModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onProjectCreated,
}) => {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [newTitle, setNewTitle] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchList = async () => {
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setLoading(true);
    try {
      const proj = await api.createProject(newTitle.trim(), aspectRatio);
      setNewTitle('');
      onProjectCreated(proj.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Удалить проект "${id}" и все его файлы?`)) return;
    try {
      await api.deleteProject(id);
      await fetchList();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Менеджер проектов</h3>
              <p className="text-xs text-slate-400">Переключение, создание и управление фильмами</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          {/* Create new project form */}
          <form onSubmit={handleCreate} className="flex flex-col gap-3 bg-dark-900/60 p-4 rounded-2xl border border-dark-700">
            <label className="text-xs font-semibold text-slate-300">Создать новый проект:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Название нового фильма (например: The Dark Knight Recap)"
                className="flex-1 bg-dark-950 border border-dark-700 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
              />
              <button
                type="submit"
                disabled={loading || !newTitle.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-dark-900 font-semibold text-xs rounded-xl shadow-lg transition"
              >
                <Plus className="w-4 h-4" />
                <span>Создать</span>
              </button>
            </div>

            {/* Format choice radio buttons */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] font-semibold text-slate-400">Формат видео и кадров:</span>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  aspectRatio === '16:9'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-300 shadow-sm'
                    : 'bg-dark-950 border-dark-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>🎬 16:9 Горизонтальный (YouTube)</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                  aspectRatio === '9:16'
                    ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm'
                    : 'bg-dark-950 border-dark-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📱 9:16 Вертикальный (Shorts / TikTok)</span>
              </button>
            </div>
          </form>

          {/* List of projects */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Все проекты ({projects.length}):
            </label>

            {projects.map((p) => {
              const isCurrent = p.id === currentProjectId;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p.id);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition ${
                    isCurrent
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                      : 'bg-dark-900/50 border-dark-700 hover:border-dark-600 hover:bg-dark-900 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`p-2.5 rounded-xl ${isCurrent ? 'bg-amber-500/20 text-amber-400' : 'bg-dark-800 text-slate-400'}`}>
                      <Film className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold">{p.title}</h4>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            Текущий
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>{p.scenes_count} реплик / сцен</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleDelete(p.id, e)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-dark-700/50 rounded-lg transition"
                    title="Удалить проект"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
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
