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
│   │   ├── core/                    # Конфигурация, мастер-промпты (16:9 / 9:16)
│   │   │   └── config.py
│   │   ├── domain/                  # Pydantic модели данных (Project, Scene, VideoConfig)
│   │   │   └── models.py
│   │   ├── services/                # Бизнес-логика приложения
│   │   │   ├── project_service.py   # Хранение, сохранение, загрузка проектов
│   │   │   ├── script_parser.py     # Парсер сценария: MOVIE PASSPORT, THUMBNAILS, SHORTS BUMPERS
│   │   │   ├── tts_service.py       # Локальная TTS: Chatterbox Turbo (без облака)
│   │   │   ├── gemini_bot.py        # Playwright бот для генерации изображений в Gemini
│   │   │   ├── thumbnail_service.py # Генерация обложек (16:9 / 9:16 адаптивно)
│   │   │   ├── whisper_service.py   # Whisper: распознавание + динамические субтитры .ass
│   │   │   └── video_service.py     # FFmpeg: 1080p, Shorts/TikTok 9:16 с интро/аутро
│   │   ├── api/                     # REST API эндпоинты
│   │   │   ├── projects_router.py
│   │   │   ├── script_router.py
│   │   │   ├── audio_router.py
│   │   │   ├── images_router.py
│   │   │   └── video_router.py
│   │   └── main.py                  # Точка входа FastAPI + Static Mounts
│   └── projects_storage/            # Локальные папки проектов (в .gitignore)
├── frontend/
│   ├── src/
│   │   ├── components/              # React компоненты студии
│   │   │   ├── Header.tsx           # Шапка, переключатель проектов
│   │   │   ├── MasterPromptModal.tsx# Копирование мастер-промпта для Claude
│   │   │   ├── ScriptImporterModal.tsx # Вставка и распознавание сценария
│   │   │   ├── ProjectManagerModal.tsx # Создание и выбор проектов
│   │   │   ├── ThumbnailModal.tsx   # Генерация и выбор превью (9:16 / 16:9)
│   │   │   ├── ShortsGeneratorModal.tsx # Нарезка Shorts/TikTok с планом по сценам
│   │   │   ├── VideoStudioModal.tsx # Экспорт 1080p, Shorts и TikToks
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

## 🌟 Возможности приложения

1. **Шаблон сценария для Claude:** нажмите *«Промпт для Claude»*, скопируйте шаблон, отправьте в Claude — получите готовый покадровый сценарий с `MOVIE PASSPORT`, `THUMBNAILS` и `SHORTS BUMPERS`.
2. **Импорт сценария:** вставьте ответ Claude — приложение мгновенно распарсит сцены, настройки жанра, шрифты субтитров, BGM и шаблоны интро/аутро.
3. **Локальная нейросеть озвучки — Chatterbox Turbo:**
   - Полностью офлайн, без облака и сторонних API.
   - Поддержка клонирования голоса через референсный аудиофайл (`--ref`).
   - Поддержка паралингвистических тегов прямо в тексте: `[clear throat]`, `[whispering]`, `[angry]`, `[groan]`, `[crying]` и др.
   - Запускается как отдельный субпроцесс (`chatterbox-project/main.py`), что изолирует тяжёлые веса нейросети от основного сервера.
4. **Браузерная генерация в Gemini:** генерация отдельных кадров или пакетная генерация всех недостающих сцен через Playwright. Поддержка 6 художественных стилей: `storytime_2d`, `vintage_comic`, `rubber_hose_1930s`, `retro_16bit`, `paper_cutout`, `sharpie_notebook`.
5. **Генерация превью (Thumbnails):** 3 варианта обложки в стиле YouTube/TikTok автоматически из сценария. Адаптивный формат: `16:9` для YouTube, `9:16` для Shorts/TikTok.
6. **Видео Студия и авто-нарезка Shorts:**
   - Сборка полного видео `1080p` с фоновой музыкой (BGM) и динамическими субтитрами.
   - Автоматическая нарезка на вертикальные **Shorts / TikTok / Reels** (`9:16`) ~40 сек каждая.
   - Каждая часть содержит: **Интро-карточка** → пауза → основной контент → пауза → **Аутро-карточка** с призывом подписаться.
   - Интро/аутро генерируются Gemini в стиле проекта и автоматически озвучиваются.
7. **Сохранение и переключение проектов:** проекты хранятся в изолированных папках (`projects_storage/<slug>/`) с полным сохранением всех настроек, кадров и аудио.

---

## ⚙️ Зависимости

| Компонент | Технология |
|-----------|-----------|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Изображения | Google Gemini (через Playwright) |
| Озвучка | [Chatterbox Turbo](https://github.com/resemble-ai/chatterbox) (локально) |
| Субтитры | OpenAI Whisper (локально) |
| Видеомонтаж | FFmpeg |

