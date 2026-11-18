# Vortex Streaming

Movies, series and anime in one app. A full-stack streaming platform modelled on the
"Full Stack Netflix Clone" tutorial by Code With Antonio, rebuilt on a React + Flask stack, with
episodes and seasons so you can watch series and anime too.

**Stack:** React (Vite) · Tailwind CSS · Framer Motion · hls.js · Flask · SQLAlchemy ·
SQLite (default) or PostgreSQL · JWT auth · FFmpeg for HLS.

## What's inside

| From the tutorial | In Vortex |
|---|---|
| Auth screen, register / sign in | Yes (JWT, bcrypt-style hashed passwords) |
| Profiles screen | Yes, up to 5 profiles per account, each with its own My List and history |
| Navbar that turns solid on scroll | Yes, plus Series / Movies / Anime pages and live search |
| Billboard with random title | Yes (`/api/titles/featured`) |
| Movie rows + hover card | Yes, rows by trending, type and genre |
| Favorites / My List | Yes, per profile |
| Play button + video player | Yes, MP4 and HLS (`.m3u8`), subtitles (WebVTT), keyboard shortcuts |
| Info modal | Yes, with seasons and episode list for series and anime |
| (new) | Continue watching, resume position, auto-play next episode, admin API |

Player shortcuts: `Space`/`K` play and pause, `←`/`→` seek 10 s, `F` fullscreen, `M` mute, `N` next episode.

## Run it

You need Python 3.10+ and Node 18+.

### 1. Backend

```bash
cd backend
python -m venv .venv
# macOS/Linux:  source .venv/bin/activate
# Windows:      .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # Windows: copy .env.example .env
python seed.py                # demo catalog + admin account
python app.py                 # API on http://localhost:5000
```

Unless overridden in `backend/.env`, the seeded admin credentials are
`admin@vortex.local` / `change-me-before-deploy`. Running `python seed.py` also syncs
those credentials if the catalog has already been seeded, without replacing the catalog.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to Flask)
```

Open http://localhost:5173, create an account, pick a profile, and start watching.

### One-process build (for deployment)

Linux/macOS:

```bash
cd frontend
npm run build
cd ../backend
pip install -r requirements-prod.txt
gunicorn app:app -b 0.0.0.0:8000
```

Windows (using SQLite):

```bat
cd frontend
npm run build
cd ..\backend
pip install -r requirements.txt waitress
waitress-serve --port=8000 app:app
```

Flask serves the built React app and the API from the same origin.

### PostgreSQL

`docker compose up -d` in the project root, run `pip install -r requirements-postgres.txt`, then set
`DATABASE_URL=postgresql://vortex:vortex@localhost:5432/vortex` in `backend/.env` and run `python seed.py`.

## The demo catalog

* **Movies**: Big Buck Bunny, Sintel, Tears of Steel and Elephants Dream, the Blender Foundation's
  open movies (Creative Commons), streamed from Google's public sample bucket.
* **Series and anime**: original placeholder shows (Dark Orbit, Neon Drift, Skyblade Academy and so on).
  Their episodes reuse the four sample clips so you can test seasons, episodes, resume and next-episode.
  Titles without artwork get a generated poster.

Replace all of this with your own content. Only add video you own or have the rights to stream.

## Adding your own movies, series and anime

Set the seeded admin credentials in `backend/.env` before deploying, for example with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. For local-only demos, you can also use the defaults created by `python seed.py` and then rotate them before an external release.

```bash
TOKEN=$(curl -s localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"${ADMIN_EMAIL}","password":"${ADMIN_PASSWORD}"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

# an anime
curl -X POST localhost:5000/api/admin/titles -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"anime","title":"My Anime","description":"...","year":2025,"maturity":"TV-14",
       "genres":["Action","Fantasy"],"poster_url":"https://.../poster.jpg","backdrop_url":"https://.../wide.jpg","featured":true}'

# an episode (use the id returned above)
curl -X POST localhost:5000/api/admin/titles/1/episodes -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"season":1,"number":1,"name":"Episode 1","video_url":"/media/my-anime-s1e1/index.m3u8","duration":24,"subtitle_url":"/media/my-anime-s1e1.vtt"}'
```

`type` is `movie`, `series` or `anime`. Movies take `video_url` directly instead of episodes.
Other admin routes: `PUT /api/admin/titles/<id>`, `DELETE /api/admin/titles/<id>`,
`DELETE /api/admin/episodes/<id>`.

### Your own video files (FFmpeg + HLS)

```bash
python backend/tools/make_hls.py ~/videos/episode1.mp4 my-anime-s1e1
```

This writes `backend/media/my-anime-s1e1/index.m3u8` and segments; Flask serves them at
`/media/my-anime-s1e1/index.m3u8`. Plain `.mp4` files dropped in `backend/media/` also work
(`/media/file.mp4`). If subtitles or video live on another domain, that host must send CORS headers.

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | returns `token`, `user`, `profiles` |
| GET | `/api/auth/me` | validate token |
| GET | `/api/browse?type=` | rows for home and category pages |
| GET | `/api/titles?type=&genre=&q=` | list and search |
| GET | `/api/titles/featured?type=` | random billboard title |
| GET | `/api/titles/<id>` | detail with episodes |
| GET/POST/DELETE | `/api/me/profiles` | manage profiles |
| GET/POST/DELETE | `/api/me/list[/<title_id>]` | My List (send `X-Profile-Id`) |
| PUT | `/api/me/progress` | save position `{title_id, episode_id, position, duration}` |
| GET | `/api/me/continue` | continue watching |

## Project layout

```
vortex/
├── backend/   app.py, models.py, seed.py, routes/, tools/make_hls.py, media/
├── frontend/  src/{pages,components,lib}, public/ (logo files)
├── backlog/   roadmap, feature notes, storage/architecture docs
└── docker-compose.yml
```

See `backlog/media-storage.md` for the recommended Supabase/local-storage architecture and upload plan before implementing a production media pipeline.

## Before you deploy

* Set strong `SECRET_KEY` and `JWT_SECRET_KEY` in `backend/.env`.
* Change or delete the seeded admin account.
* Set `CORS_ORIGINS` to your site's origin if the frontend is hosted separately
  (and `VITE_API_URL` at build time).
* Use PostgreSQL and serve behind HTTPS.
* In production, set `APP_ENV=production` and ensure `SECRET_KEY`, `JWT_SECRET_KEY`,
  `ADMIN_EMAIL`, and `ADMIN_PASSWORD` are all populated from environment variables or a secret manager.
* Register/login endpoints are rate-limited to reduce brute-force abuse.
* Account settings support password changes, account deletion, reviewing active device sessions, ending an individual session, and revoking all sessions. Password recovery and email verification require SMTP configuration (`SMTP_HOST`, `SMTP_FROM`, credentials, and `APP_BASE_URL`); set `REQUIRE_EMAIL_VERIFICATION=true` to require verified addresses at sign-in.
* Uploaded videos and subtitles linked to catalog entries are played through signed URLs. Set `MEDIA_URL_TTL_SECONDS` to a value between 60 and 86400 (default four hours). For Supabase, make the configured storage bucket private; the Flask backend signs each object request and keeps the service-role key server-side.
* The frontend includes a web app manifest, offline app shell, and install prompts. Service-worker installation requires HTTPS in production (localhost is allowed for development).
* Use `flask --app app db init` and `flask --app app db migrate` for schema changes; keep Alembic migrations under version control.
* Use `gunicorn app:app -b 0.0.0.0:8000` as the WSGI server, or `waitress-serve --port=8000 app:app` on Windows.

### Media and admin upload workflow

The app now includes an admin upload route at `/api/media/upload` for posters, backdrops,
subtitles and video files. Uploads are stored under `backend/media/<kind>/`, validated by extension
and size, and returned as a relative media URL like `/media/video/<file>.mp4`.
Use this route from the admin dashboard or from an external uploader before linking the URL to a title or episode.

Set `TMDB_API_KEY` to enable TMDB imports. Admins can scan only explicitly configured
`MEDIA_SCAN_ROOTS` directories; separate paths with semicolons on Windows and colons on Linux/macOS.
The scanner recognizes episode names such as `Show S01E03.mkv`, skips symlinks, and registers files
without moving them. Configure `FFMPEG_BIN` when FFmpeg is not available on `PATH`; generated
thumbnails are stored in the local media directory. AniList imports do not require a key.
