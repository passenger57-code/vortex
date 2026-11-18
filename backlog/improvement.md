# Vortex — Improvements

This document records improvements suggested by reviewing the uploaded project source. Items are recommendations until implemented and verified.

## 1. Security and configuration

### Critical
- **Protect environment files.** The uploaded archive contains `backend/.env`. Do not distribute real environment secrets in ZIP files or commit them to Git. Keep `.env.example` as a template with placeholder values.
- **Remove development secret fallbacks for production.** `config.py` currently supplies fallback secret strings. Production startup should reject missing or weak `SECRET_KEY` and `JWT_SECRET_KEY`.
- **Change demo administrator credentials.** The README documents a seeded admin login. Never deploy with those credentials.
- **Add rate limiting.** Protect registration and login from brute-force and automated abuse.
- **Review authorization boundaries.** Add tests proving that users cannot access another user's profiles, favorites, or watch progress by changing request IDs or headers.
- **Review token storage.** The frontend stores the JWT in `localStorage`. Consider the XSS implications and evaluate a secure, HttpOnly cookie-based session design before public deployment.

### Important
- Validate and normalize all incoming API fields, including title type, year, duration, maturity rating, URLs, episode number and season.
- Add request size limits and safe upload validation before implementing media uploads.
- Configure production CORS to allow only the actual frontend origin.
- Add security headers and enforce HTTPS in production.
- Avoid returning internal exception details to clients.

## 2. Backend architecture and reliability

- Add Flask-Migrate/Alembic so database schema changes are versioned. The app currently calls `db.create_all()` at startup; that is convenient for an MVP but is not a migration strategy.
- Add database indexes for frequently filtered/sorted fields and review query plans as the catalog grows.
- Add pagination controls to catalog/search screens. The titles API supports `limit` and `offset`, but the user interface should expose sensible paging or load-more behavior.
- Add consistent API response/error conventions and centralized error handlers.
- Add structured logging for authentication, media processing and unexpected server errors. Never log passwords or tokens.
- Add database backup and restore instructions.
- Add a dedicated health/readiness check that can report whether the database is reachable.
- Consider a service layer for catalog and progress logic as route complexity increases.

## 3. Frontend experience

- Add an admin-only route and navigation entry.
- Add loading, empty, error and retry states consistently across all pages.
- Add a proper 404 page instead of redirecting every unknown route to the home page.
- Add route guards for signed-out users and users who have not selected a profile.
- Improve search with request cancellation/debouncing and a clear-search action.
- Add accessible labels, focus states and keyboard navigation to dialogs, menus and the player.
- Add skeletons that match the final card/row layout.
- Verify responsive layouts on narrow phones, tablets and desktop screens.
- Add image fallback handling and lazy loading for catalog artwork.
- Add a user-facing playback error with retry and troubleshooting options.

## 4. Playback and media

- Test playback across Chrome, Edge, Firefox and Safari where available.
- Test HLS playback on both native-HLS browsers and hls.js browsers.
- Add quality selection where multiple HLS renditions are available.
- Add playback speed selection.
- Add subtitle selection and language labels, not just a single default English track.
- Add audio-track selection when the media source supports it.
- Improve progress saving around tab close, navigation, network loss and episode changes.
- Verify that the final few seconds of an episode/movie do not cause confusing resume behavior.
- Add a clear “Up Next” countdown with cancel/disable controls.
- Add media processing status and validation for missing or broken files.
- Use a CDN or object storage for larger libraries rather than serving all production video from the Flask process.

## 5. Data and catalog quality

- Add fields for original title, synopsis, release date, runtime, content rating, language and country where useful.
- Add separate artwork handling for posters, backdrops and episode thumbnails.
- Add unique constraints for season/episode numbering within a title.
- Add a content status such as draft, published or archived.
- Add catalog metadata validation and a way to preview a title before publishing.
- Keep demo data clearly separated from real catalog content.

## 6. Developer experience

- Add backend and frontend test suites.
- Add lint/format scripts and document how to run them.
- Add a single development setup guide with Windows PowerShell commands as well as macOS/Linux commands.
- Keep generated folders such as `.venv`, `node_modules`, `dist`, local databases and generated media out of source archives unless there is a specific reason to include them.
- Add a CI workflow that installs dependencies, runs tests and builds the frontend.
- Pin and periodically review dependencies.

## Priority order

| Priority | Improvement | Reason |
|---|---|---|
| P0 | Remove secrets from archives/source control; replace production secrets | Prevent account and deployment compromise |
| P0 | Change seeded admin credentials | Prevent unauthorized catalog control |
| P1 | Add authorization and API tests | Protect user/profile data |
| P1 | Build admin dashboard | Make catalog management practical |
| P1 | Add database migrations | Make future schema changes safe |
| P1 | Add upload validation and controlled media processing | Avoid unsafe file handling |
| P2 | Improve player recovery and playback settings | Improve the core viewing experience |
| P2 | Add pagination and better search behavior | Keep the app responsive as the catalog grows |
| P2 | Add accessibility and responsive QA | Improve usability for more viewers |
| P3 | Add analytics, recommendations and social features | Expand the product after the core is dependable |
