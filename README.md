# CRM Belarus

Внутренняя CRM-система для отдела поддержки клиентов Belarus. Полная техническая спецификация лежит в папке `ТЗ/`, инструкции для AI-ассистентов — в `AGENTS.md` и `skills/`.

## Технологический стек

- **UI:** Vite + React 19 + TypeScript, Mantine v7, TanStack Router, TanStack Query, Zod
- **Backend:** Supabase self-hosted (Postgres 15, GoTrue, PostgREST, Realtime, Storage, Studio)
- **Инфраструктура:** Docker Compose v2 (нужна версия с поддержкой `include:` — v2.20+)

## Быстрый старт

### 0. Предварительно должно быть установлено

- Docker Desktop (или Docker Engine + Compose v2) — должен быть запущен
- Node.js ≥ 20 (для локальной разработки фронта)
- Git

### 1. Секреты для Supabase

Секреты для self-hosted Supabase уже сгенерированы в `./supabase/.env`. Если нужно сгенерировать заново:

```bash
cd supabase
sh ./utils/generate-keys.sh --update-env       # JWT + симметричные ключи
sh ./utils/add-new-auth-keys.sh --update-env   # асимметричные ES256-ключи
```

Порты в `./supabase/.env` уже сдвинуты на диапазон `54320–54329`, чтобы не конфликтовать со стандартной локальной установкой Supabase.

### 2. Корневой `.env` для фронта

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

Откройте `.env` и подставьте `ANON_KEY` из `./supabase/.env` в переменную `VITE_SUPABASE_ANON_KEY` (при первоначальной настройке это уже сделано автоматически).

### 3. Поднимаем Supabase

```bash
docker compose up -d
```

Что поднимется:

| Сервис                        | Порт на хосте           |
| ----------------------------- | ----------------------- |
| Supabase API + Studio (Kong)  | `http://localhost:54321` |
| Postgres (через пулер Supavisor) | `localhost:54322`    |
| Пулер в transaction-режиме   | `localhost:54329`       |
| UI (crm-belarus)            | `http://localhost:8080` |

Логин в Studio — `supabase` / значение `DASHBOARD_PASSWORD` из `./supabase/.env`.

### 4. Разработка фронта

```bash
cd app
npm install
npm run dev          # http://localhost:5173, HMR
npm run typecheck    # tsc -b --noEmit
npm run lint         # eslint .
npm run build        # прод-сборка в ./app/dist
npm run gen:types    # обновить src/types/database.ts из схемы Postgres
```

Vite берёт `VITE_*` переменные из корневого `./.env` благодаря настройке `envDir: '..'` в `vite.config.ts`.

## Структура репозитория

```
.
├── app/                    Vite + React SPA (Mantine, TanStack)
│   ├── src/
│   │   ├── lib/            supabase client, react-query client
│   │   ├── pages/          компоненты страниц
│   │   ├── router.tsx      TanStack Router
│   │   ├── theme.ts        Mantine theme
│   │   └── types/          сгенерированные типы БД
│   ├── Dockerfile          multi-stage nginx-образ
│   └── nginx.conf          SPA-фолбэк, gzip, кеш статики
├── supabase/               self-hosted стек (docker-compose, volumes, utils/)
├── ТЗ/                     техническая спецификация (на русском)
├── skills/                 инструкции для AI-ассистентов (на английском)
├── AGENTS.md               общий контекст для AI
├── docker-compose.yml      корневой compose: UI + include: ./supabase
├── .env.example            шаблон переменных для UI-контейнера
└── README.md
```
