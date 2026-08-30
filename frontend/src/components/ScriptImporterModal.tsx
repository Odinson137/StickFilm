import React, { useState } from 'react';
import { X, FileText, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Scene } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: {scenes: Scene[], settings?: any, thumbnails?: any[]}) => void;
}

export const ScriptImporterModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
  const [scriptText, setScriptText] = useState<string>('');
  const [parsedData, setParsedData] = useState<{scenes: Scene[], settings?: any, thumbnails?: any[]} | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!scriptText.trim()) {
      setError('Вставьте текст сценария из Claude');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await api.parseScript(scriptText);
      if (!data || !data.scenes || data.scenes.length === 0) {
        setError('Не удалось распознать реплики. Убедитесь, что сценарий оформлен таблицей или нумерованным списком.');
      } else {
        setParsedData(data);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка парсинга сценария');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedData && parsedData.scenes.length > 0) {
      onImport(parsedData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Импорт сценария из Claude</h3>
              <p className="text-xs text-slate-400">Вставьте ответ Claude (Markdown таблицу или список сцен)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-dark-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-300">Текст сценария / Markdown Таблица:</label>
            <textarea
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
                setParsedData(null);
                setError(null);
              }}
              placeholder={`Вставьте сюда таблицу из Claude, например:\n| Shot | Timing | Voiceover (EN) | Visual Scene Description | Image Prompt |\n| shot_01 | [0:00 - 0:04] | Peter Parker delivers pizza... | ... | ... |`}
              className="w-full h-56 bg-dark-900 border border-dark-700 rounded-xl p-4 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {parsedData && parsedData.scenes.length > 0 && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>Успешно распознано сцен: <strong>{parsedData.scenes.length}</strong></span>
              </div>
              <span className="text-[11px] text-slate-400">Готово к загрузке в проект</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-800/80 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-700 rounded-xl transition"
          >
            Отмена
          </button>
          
          <div className="flex items-center gap-3">
            {!parsedData || parsedData.scenes.length === 0 ? (
              <button
                onClick={handleParse}
                disabled={loading || !scriptText.trim()}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg transition"
              >
                <span>{loading ? 'Распознавание...' : 'Распознать сцены'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleConfirmImport}
                className="flex items-center gap-2 px-6 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-dark-900 rounded-xl shadow-lg shadow-emerald-500/20 transition transform active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Импортировать {parsedData.scenes.length} сцен</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
