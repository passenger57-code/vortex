# Vortex — Recommendations

## Overall recommendation

Treat Vortex as a working MVP and move into a **stability + content-management phase** before attempting advanced streaming-platform features.

The most valuable next milestone is an **Admin Dashboard connected to the existing Flask admin API**. The backend already exposes protected endpoints for creating, updating and deleting titles and for adding/removing episodes. The React app currently has no admin page/route, so a dashboard would close a clear gap between the backend and the product experience.

## Recommended development sequence

### 1. Security cleanup first
Do not deploy or share the current archive publicly until environment secrets and the demo admin credentials have been reviewed. The uploaded archive includes `backend/.env`; do not assume its values are safe to distribute. If it contains real credentials, rotate them. Keep secrets out of Git and release ZIPs.

### 2. Add the Admin Dashboard
Build these screens in this order:

1. **Admin overview** — counts for movies, series, anime and episodes.
2. **Catalog manager** — searchable/filterable list of all titles.
3. **Title editor** — create/edit title metadata and artwork URLs.
4. **Season and episode manager** — add, edit and remove episodes.
5. **Preview/publish controls** — review a title before making it visible to viewers.

Reuse the existing API endpoints wherever they fit. Add new endpoints only where the UI needs data or operations that the current API does not provide.

### 3. Make content ingestion dependable
After the dashboard works, implement secure media uploads and a controlled FFmpeg-to-HLS workflow. Start with posters and metadata, then video and subtitle files. Show processing progress and errors to the administrator.

### 4. Lock down the viewing experience
Create repeatable tests for registration/login, profile isolation, My List, progress saving, movie playback, episode playback, subtitles and next-episode behavior. Fix any failures before expanding the feature set.

### 5. Prepare the database and deployment
Introduce migrations, use PostgreSQL in production, configure secrets/HTTPS/CORS, add backups and logging, and establish a repeatable deployment process.

## What I would build next, specifically

**Milestone: Vortex Admin Dashboard — first implementation**

Suggested frontend structure:

```text
frontend/src/
  pages/
    admin/
      AdminLayout.jsx
      AdminOverview.jsx
      AdminTitles.jsx
      AdminTitleForm.jsx
      AdminEpisodes.jsx
  components/
    admin/
      AdminSidebar.jsx
      TitleTable.jsx
      TitleForm.jsx
      EpisodeForm.jsx
```

Suggested implementation tasks:

- Add an admin route protected by the authenticated user's `is_admin` value.
- Add an admin navigation link only for administrators.
- Fetch catalog data from the existing titles API.
- Create forms that call the existing admin title and episode endpoints.
- Add form validation, loading states, API error messages and delete confirmations.
- Test that a normal account receives an access-denied result and cannot use admin endpoints.

The folder layout is a proposal; it is not present in the uploaded project yet.

## Decisions to make before implementation

- **Media storage:** local disk for development; object storage/CDN or a dedicated media server for production.
- **Content access:** public catalog browsing versus signed-in-only browsing.
- **Profiles:** whether child profiles and parental controls are part of the intended product.
- **Availability:** whether Vortex is a personal/local library or a public multi-user streaming service. This affects storage, hosting, licensing, moderation, security and cost.
- **Content source:** only use videos and artwork you own, have licensed, or are otherwise authorized to distribute.

## Avoid doing these things yet

- Do not build a complex recommendation engine before collecting reliable viewing data.
- Do not add social feeds, live chat or comments before moderation and abuse controls exist.
- Do not add payments/subscriptions until the service model, licensing and deployment plan are clear.
- Do not rewrite the existing player or backend without a failing test or a specific requirement.
- Do not treat the current demo catalog as production content.

## Success criteria for the next milestone

The Admin Dashboard milestone is complete when an administrator can create a movie, create a series/anime, add episodes, edit metadata, remove a test title, and see the changes reflected in Browse/Search — while a normal user cannot access admin screens or admin API actions.
