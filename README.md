# 🎬 Stickfilm Studio

Полнофункциональное десктопное / веб-приложение для **автоматического создания стикман-пересказов фильмов** (Sam O'Nella / Paint doodle style).

---

## 🚀 Быстрый запуск в 1 клик

Просто запустите файл:
```bat
run_stickfilm.bat
```
Скрипт автоматически запустит:
1. **Python FastAPI Backend** на `http://localhost:8000`
2. **React + Vite Frontend** на `http://localhost:5173`
3. Откроет интерфейс студии в вашем браузере по умолчанию.

---

## 🛠️ Архитектура проекта (Clean Architecture)

```
Stickfilm/
├── backend/
│   ├── app/
│   │   ├── core/                    # Конфигурация, токены ElevenLabs, мастер-промпт
│   │   │   ├── config.py
│   │   │   └── tokens.py
│   │   ├── domain/                  # Pydantic модели данных (Project, Scene, VideoConfig)
│   │   │   └── models.py
│   │   ├── services/                # Бизнес-логика приложения
│   │   │   ├── project_service.py   # Хранение, сохранение, загрузка проектов
│   │   │   ├── script_parser.py     # Парсер Markdown-таблиц / списков из Claude
│   │   │   ├── tts_service.py       # ElevenLabs API с пулом токенов и ротацией
│   │   │   ├── gemini_bot.py        # Playwright браузерный бот для генерации в Gemini
│   │   │   ├── whisper_service.py   # Whisper распознавание и динамические субтитры .ass
│   │   │   └── video_service.py     # FFmpeg: Full 1080p, Shorts (<60s) и TikToks (>60s)
│   │   ├── api/                     # REST API эндпоинты
│   │   │   ├── projects_router.py
│   │   │   ├── script_router.py
│   │   │   ├── audio_router.py
│   │   │   ├── images_router.py
│   │   │   └── video_router.py
│   │   └── main.py                  # Точка входа FastAPI + Static Mounts
│   └── projects_storage/            # Локальные папки проектов
├── frontend/
│   ├── src/
│   │   ├── components/              # React компоненты студии
│   │   │   ├── Header.tsx           # Шапка, переключатель проектов, кнопка Сохранить
│   │   │   ├── MasterPromptModal.tsx# Копирование мастер-промпта для Claude
│   │   │   ├── ScriptImporterModal.tsx # Вставка и распознавание сценария
│   │   │   ├── TokenSettingsModal.tsx  # Управление пулом ключей ElevenLabs
│   │   │   ├── ProjectManagerModal.tsx # Создание и выбор проектов
│   │   │   ├── VideoStudioModal.tsx    # Экспорт 1080p, Shorts и TikToks
│   │   │   ├── SceneList.tsx        # Левая колонка со списком всех реплик
│   │   │   └── SceneDetail.tsx      # Центральный инспектор кадра и аудио
│   │   ├── services/api.ts          # Axios клиент
│   │   ├── types/index.ts           # TypeScript интерфейсы
│   │   ├── App.tsx                  # Главный макет студии
│   │   └── index.css                # Стили Tailwind
├── run_stickfilm.bat                # Запуск в 1 клик
└── README.md
```

---

## 🌟 Возможности приложения:
1. **Шаблон сценария для Claude:** нажмите *"1. Промпт для Claude"*, скопируйте шаблон, отправьте в Claude и получите готовый покадровый сценарий с безопасными стикман-промптами.
2. **Импорт сценария:** нажмите *"2. Импорт сценария"*, вставьте ответ Claude — приложение мгновенно создаст список сцен с репликами и таймкодами.
3. **Пул токенов ElevenLabs:** автоматическое переключение на следующий ключ при исчерпании квоты символов.
4. **Браузерная генерация в Gemini:** генерация отдельных кадров или пакетная генерация всех недостающих сцен через Playwright.
5. **Видео Студия и авто-нарезка:**
   - Сборка полного видео 1080p с ускорением 1.2x.
   - Автоматическая нарезка **Shorts (< 60s)** и **TikToks (> 60s)** в вертикальном формате 9:16 с анимированными караоке-субтитрами.
6. **Сохранение и переключение проектов:** проекты хранятся в изолированных папках (`spider-man-1`, `spider-man-2`, новые фильмы).
