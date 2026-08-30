import React, { useState, useEffect } from 'react';
import { X, Key, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { TokenItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TokenSettingsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [tokens, setTokens] = useState<TokenItem[]>([]);
  const [newKey, setNewKey] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTokens = async () => {
    try {
      const list = await api.getTokens();
      setTokens(list);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTokens();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await api.addToken(newKey.trim());
      setNewKey('');
      await fetchTokens();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteToken = async (key: string) => {
    try {
      await api.deleteToken(key);
      await fetchTokens();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckQuota = async (key: string) => {
    setCheckingKey(key);
    try {
      await api.checkToken(key);
      await fetchTokens();
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-dark-800 border border-dark-600 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">Пул токенов ElevenLabs API</h3>
              <p className="text-xs text-slate-400">Автоматическая ротация токенов при исчерпании лимитов</p>
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
          {/* Add Token Input */}
          <form onSubmit={handleAddToken} className="flex gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Вставьте новый ElevenLabs API ключ (sk_...)"
              className="flex-1 bg-dark-900 border border-dark-700 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
            />
            <button
              type="submit"
              disabled={loading || !newKey.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-dark-900 font-semibold text-xs rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить</span>
            </button>
          </form>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Tokens List */}
          <div className="flex flex-col gap-2.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Активные токены в пуле ({tokens.length}):
            </label>

            {tokens.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 bg-dark-900/40 rounded-xl border border-dashed border-dark-700">
                Нет добавленных ключей. Добавьте хотя бы один ключ ElevenLabs для генерации озвучки.
              </div>
            ) : (
              tokens.map((t, idx) => (
                <div
                  key={t.key}
                  className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                    t.active
                      ? 'bg-dark-900/60 border-dark-700'
                      : 'bg-red-950/20 border-red-900/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-500">#{idx + 1}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-slate-200">
                          {t.key.substring(0, 10)}••••••••••••••••{t.key.substring(t.key.length - 6)}
                        </span>
                        {t.active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Активен
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                            <XCircle className="w-3 h-3" /> Исчерпан
                          </span>
                        )}
                      </div>
                      {t.remaining_chars >= 0 && (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Осталось символов: <span className="text-amber-400 font-medium">{t.remaining_chars.toLocaleString()}</span>
                        </p>
                      )}
                      {t.last_error && !t.active && (
                        <p className="text-[11px] text-red-400 mt-0.5">{t.last_error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCheckQuota(t.key)}
                      disabled={checkingKey === t.key}
                      title="Проверить лимит символов"
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-dark-700 rounded-lg transition"
                    >
                      <RefreshCw className={`w-4 h-4 ${checkingKey === t.key ? 'animate-spin text-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDeleteToken(t.key)}
                      title="Удалить токен"
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Как работает ротация:</strong> Stickfilm автоматически использует первый активный ключ. Если у него заканчивается квота символов, система плавно переключается на следующий ключ в списке без прерывания генерации.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-dark-700 bg-dark-800/80 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-dark-700 hover:bg-dark-600 text-slate-200 rounded-xl transition"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};
