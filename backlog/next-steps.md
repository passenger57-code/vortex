# Vortex — Next Steps

> Project review based on the uploaded Vortex source archive. This is a roadmap, not a claim that the listed work has already been implemented or tested.

## Current project snapshot

Vortex is a React + Vite + Tailwind CSS + Framer Motion frontend backed by Flask, SQLAlchemy and JWT authentication. SQLite is the default database, with PostgreSQL configuration available. The project already contains:

- Registration, login and token validation
- Up to five profiles per account
- Browse pages for movies, series and anime
- Featured title / billboard, title rows and genre filtering
- Search and My List
- A watch page with MP4/HLS playback, WebVTT subtitles and keyboard shortcuts
- Continue-watching progress saved by profile
- Season and episode data, plus automatic next-episode behavior
- Admin-protected API endpoints for creating, editing and deleting titles and episodes
- A demo catalog and a video-to-HLS helper script

The frontend currently has no dedicated admin page or admin route in `App.jsx`. Content administration is therefore API-driven at this stage.

## Recommended order

### Step 0 — Protect the project before adding features

- [ ] Check that `backend/.env` is not committed to Git or shared in public archives.
- [ ] Keep real secrets only in local environment configuration.
- [ ] Replace the development fallback `SECRET_KEY` and `JWT_SECRET_KEY` before any deployment.
- [ ] Change or remove the demo admin account and password documented in the README before exposing the app.
- [ ] Add/verify `.gitignore` entries for `.env`, virtual environments, database files, generated media, and build artifacts where appropriate.
- [ ] If the uploaded `.env` contained real credentials, rotate those credentials. The archive was not inspected for secret values.

**Done when:** no real credentials are present in source control or distributable archives, and production configuration fails safely when required secrets are missing.

### Step 1 — Verify the existing MVP end to end

- [ ] Start Flask and the React development server.
- [ ] Register a normal account and sign in.
- [ ] Create, select, and delete profiles; verify the five-profile limit.
- [ ] Browse movies, series and anime.
- [ ] Search for titles and open a title detail view.
- [ ] Add and remove a title from My List.
- [ ] Play a sample movie and an episode.
- [ ] Test pause/resume, seeking, subtitles, fullscreen and keyboard shortcuts.
- [ ] Leave a video partway through, return to the home page, and verify Continue Watching.
- [ ] Refresh the browser and verify that the session/profile behavior is sensible.
- [ ] Test an invalid login, expired/invalid token, missing video URL and unavailable media URL.
- [ ] Check browser console and Flask logs for errors.

**Done when:** the main user journey works consistently and failures show useful messages.

### Step 2 — Build the Vortex Admin Dashboard (recommended next development milestone)

Create a protected `/admin` area in the React app.

- [ ] Show the admin navigation only to authenticated admin users.
- [ ] Add a dashboard overview with catalog totals (movies, series, anime, episodes).
- [ ] Add a title table with search and type filters.
- [ ] Add Create / Edit / Delete title forms.
- [ ] Add season and episode management for series and anime.
- [ ] Validate required fields and show API errors clearly.
- [ ] Add confirmation before destructive actions.
- [ ] Refresh catalog data after successful changes.
- [ ] Add an access-denied screen for non-admin accounts.

The backend already has admin endpoints for title and episode management, so start by connecting the UI to those existing routes rather than rewriting the API.

**Done when:** an administrator can manage the catalog through the app without using curl or manually editing the database.

### Step 3 — Improve media management

- [ ] Decide whether media will be stored locally, on a dedicated media server, or in object storage.
- [ ] Add an admin upload workflow for posters, backdrops, subtitles and video files.
- [ ] Validate file type, size and upload permissions on the server.
- [ ] Integrate the existing FFmpeg HLS conversion helper into a controlled workflow.
- [ ] Show processing status and conversion errors.
- [ ] Verify HLS playlists and segments are served correctly.
- [ ] Keep media paths separate from user-supplied arbitrary filesystem paths.

**Done when:** an admin can add a title and its media through a documented, repeatable workflow.

### Step 4 — Add automated quality checks

- [ ] Add backend tests for authentication, profile ownership, list/progress endpoints and admin authorization.
- [ ] Add frontend tests for key flows and important components.
- [ ] Add linting and test scripts to `frontend/package.json`.
- [ ] Add a repeatable production build check.
- [ ] Test with both SQLite and PostgreSQL.
- [ ] Test migrations against a copy of the database before applying them to important data.

**Done when:** core behavior can be checked automatically after changes.

### Step 5 — Prepare for deployment

- [ ] Use PostgreSQL for production.
- [ ] Introduce database migrations (for example, Flask-Migrate/Alembic) rather than relying on `db.create_all()` for schema evolution.
- [ ] Configure HTTPS, secure cookies/token handling as appropriate, CORS allowlists and environment secrets.
- [ ] Add rate limiting to authentication and other abuse-sensitive endpoints.
- [ ] Configure production logging, backups and health monitoring.
- [ ] Use a production WSGI server and a proper static/media hosting strategy.
- [ ] Review content licensing and only stream content you own or are authorized to distribute.

## The very next task

**Build the Admin Dashboard UI using the existing `/api/admin` endpoints.** Before starting that feature, complete Step 0 and run the Step 1 smoke test. This gives Vortex a practical way to add real catalog content and test the full product with less manual API work.
