# Развёртывание CRM Belarus на новой машине

Пошаговая инструкция. Всё запускается из **корня проекта** в **PowerShell** (или через `.cmd`-обёртки двойным кликом, если не хочется возиться с execution policy).

---

## Требования

| Компонент | Минимальная версия |
|-----------|--------------------|
| Windows | 10 / 11 (x64) |
| Docker Desktop | 4.x (с Docker Compose v2) |
| Git | 2.x |
| Node.js | 20+ (**опционально**, нужен только для локальной разработки без Docker: `npm run dev`, линтер, тесты, regen типов) |

Docker Desktop должен быть запущен и переключён в **Linux containers**.

---

## Быстрый старт

```powershell
.\setup\01-install-prerequisites.ps1   # проверка Git / Docker / Compose
.\setup\02-setup-supabase.ps1          # .env из .env.example, backups/, CRLF->LF
.\setup\03-start-stack.ps1             # docker compose up -d --build (Supabase + UI)
.\setup\04-restore-db.ps1              # (опционально) восстановить БД из backups/*.dump
.\setup\05-healthcheck.ps1             # проверка, что всё поднялось
.\setup\06-backup-db.ps1               # сделать pg_dump в backups/ (ручной бэкап)
```

Скрипты идемпотентны — повторный запуск ничего не ломает.

Если PowerShell ругается на execution policy, используйте `.cmd`-обёртки рядом (они запускают `.ps1` с `-ExecutionPolicy Bypass`) или один раз запустите `setup\fix-execution-policy.cmd`.

---

## Что делает каждый скрипт

### 1. `01-install-prerequisites.ps1`

Проверяет наличие `git`, `docker`, `docker compose` и живой Docker daemon. Node.js проверяется как опциональная зависимость.

### 2. `02-setup-supabase.ps1`

- Проверяет, что `supabase/docker-compose.yml` на месте (Supabase self-hosted уже в репозитории).
- Создаёт корневой `.env` из `.env.example`, если его нет.
- Создаёт `supabase/.env` из `supabase/.env.example`, если его нет. Текущие JWT-ключи в примере подходят для dev; для продакшена **обязательно** сменить секреты (`POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `DASHBOARD_PASSWORD`).
- Создаёт папку `backups/` (для `pg_dump` файлов).
- Копирует `local-test-accounts.md` из `.example`-шаблона, если его нет.
- Чинит окончания строк (CRLF→LF) в `supabase/volumes/pooler/pooler.exs` и `supabase/volumes/logs/vector.yml` — Windows-клоны этих файлов ломают Elixir/Vector внутри контейнеров.

### 3. `03-start-stack.ps1`

Одна команда `docker compose up -d --build` в корне поднимает всё: корневой `docker-compose.yml` через директиву `include:` подтягивает `supabase/docker-compose.yml`.

Собирается UI-контейнер `crm-belarus` (Vite-бандл → nginx) и стек Supabase (db, kong, auth, rest, storage, studio, realtime, pooler, analytics, meta, imgproxy, vector, edge-functions).

Скрипт ждёт, пока `crm-supabase-db` станет `healthy` (до 180 сек).

### 4. `04-restore-db.ps1`

Восстанавливает БД из pg_dump-файла (`.dump`).

```powershell
.\setup\04-restore-db.ps1                                  # последний .dump из backups/
.\setup\04-restore-db.ps1 -BackupFile "backups\my.dump"    # конкретный файл
```

Читает `POSTGRES_PASSWORD` из `supabase/.env`, копирует дамп в контейнер `crm-supabase-db`, выполняет `pg_restore --clean --if-exists --no-owner --no-privileges`, затем показывает список таблиц в `public`.

> Если нужно не восстанавливать дамп, а прогнать миграции + сид — используйте Supabase CLI: `supabase db push` + `psql -f supabase/seed/local_test_users.sql` (подробнее — в `skills/03-database-migrations.md`).

### 5. `05-healthcheck.ps1`

Проверяет:

- Состояние контейнеров Supabase (`crm-supabase-*`, включая realtime с префиксом `realtime-dev.`) и `crm-belarus`.
- `pg_isready` внутри `crm-supabase-db` и количество таблиц в `public`.
- HTTP-endpoints: UI `http://localhost:8080`, Kong `http://localhost:54321`, `http://localhost:54321/auth/v1/health`.

### 6. `06-backup-db.ps1`

Делает `pg_dump -Fc` внутри `crm-supabase-db` и сохраняет файл в `backups/`.
Итоговый `.dump` можно восстанавливать скриптом `04-restore-db.ps1`.

```powershell
.\setup\06-backup-db.ps1                                  # backups\supabase-postgres-<timestamp>.dump
.\setup\06-backup-db.ps1 -OutputFile "backups\my.dump"    # свой путь
.\setup\06-backup-db.ps1 -KeepLast 10                     # ротация: оставить N последних
.\setup\06-backup-db.ps1 -SchemaOnly                      # только схема, без данных
.\setup\06-backup-db.ps1 -DataOnly                        # только данные, без схемы
```

Флаги `pg_dump`: `-Fc --no-owner --no-privileges` — portable формат, совместимый с `pg_restore --clean` на любом self-hosted Supabase.

---

## Порты

| Сервис | Порт |
|--------|------|
| UI (`crm-belarus`, nginx со статикой) | **8080** |
| Supabase API + Studio (Kong) | **54321** |
| Postgres через Supavisor (session pooler) | **54322** |
| Postgres через Supavisor (transaction pooler) | **54329** |

Подробности по `.env` и дефолтным значениям — в корневых `.env.example` и `supabase/.env.example`, плюс `skills/01-infrastructure.md`.

---

## Полный сброс

Удалит все данные Postgres, Storage и т.д.:

```powershell
docker compose down -v
```

Затем повторить шаги 3–4.

---

## Структура папки `setup/`

```
setup/
├── README.md                      # эта инструкция
├── 01-install-prerequisites.ps1   # проверка зависимостей
├── 02-setup-supabase.ps1          # .env, backups/, CRLF->LF
├── 03-start-stack.ps1             # docker compose up -d --build
├── 04-restore-db.ps1              # восстановление БД из .dump
├── 05-healthcheck.ps1             # проверка здоровья сервисов
├── 06-backup-db.ps1               # pg_dump в backups/*.dump
├── *.cmd                          # обёртки для PowerShell-скриптов
└── fix-execution-policy.cmd       # разовая попытка починить execution policy
```

---

## Создание нового бэкапа

```powershell
.\setup\06-backup-db.ps1
```

Подробнее — секция «`06-backup-db.ps1`» выше. Результат сразу совместим с `04-restore-db.ps1`.
