import React, { useState, useEffect } from 'react';
import { Copy, Check, X, Sparkles, Film } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentAspectRatio?: '16:9' | '9:16';
}

export const MasterPromptModal: React.FC<Props> = ({ isOpen, onClose, currentAspectRatio = '16:9' }) => {
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>(currentAspectRatio);
  const [prompt, setPrompt] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setAspectRatio(currentAspectRatio);
    }
  }, [isOpen, currentAspectRatio]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.getMasterPrompt(aspectRatio)
        .then(res => setPrompt(res.prompt))
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, aspectRatio]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Промпт для сценария (Claude)</h3>
              <p className="text-xs text-slate-400">Скопируйте этот системный промпт, вставьте в Claude и укажите название фильма</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Format toggle tabs */}
            <div className="flex items-center bg-dark-900 border border-dark-700 rounded-xl p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  aspectRatio === '16:9'
                    ? 'bg-amber-500 text-dark-900 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                16:9
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  aspectRatio === '9:16'
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                9:16 Shorts
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-dark-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-300 bg-dark-900/50 m-4 rounded-xl border border-dark-700 whitespace-pre-wrap leading-relaxed select-text">
          {loading ? 'Загрузка шаблона промпта...' : prompt}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700 bg-dark-800/80 rounded-b-2xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Film className="w-4 h-4 text-amber-400" />
            <span>Вставьте результат ответа Claude обратно в Stickfilm</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-dark-700 rounded-xl transition"
            >
              Закрыть
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-dark-900 rounded-xl shadow-lg shadow-amber-500/20 transition transform active:scale-95"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Скопировано!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Скопировать промпт</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
