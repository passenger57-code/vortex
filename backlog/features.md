# Vortex — Feature Ideas

This list separates features already present in the uploaded project from additions worth considering. Suggested features are not implemented unless explicitly marked as existing.

## Existing features found in the project

- [x] Account registration and login with JWT
- [x] Password hashing
- [x] Multiple profiles (up to five per account)
- [x] Browse movies, series and anime
- [x] Featured billboard
- [x] Trending/popular and genre rows
- [x] Search titles
- [x] My List / favorites per profile
- [x] Movie playback
- [x] Series and anime seasons/episodes
- [x] MP4 playback
- [x] HLS playback through hls.js where needed
- [x] WebVTT subtitle track support
- [x] Keyboard player shortcuts
- [x] Continue Watching and resume position
- [x] Automatic next episode
- [x] Admin-protected API endpoints for title and episode management
- [x] FFmpeg HLS conversion helper

## Phase 1 — Essential product features

These should come before advanced or social features.

- [ ] Admin dashboard for catalog management
- [ ] Secure poster, backdrop, subtitle and video uploads
- [ ] Edit episode metadata and reorder episodes
- [ ] Publish/unpublish and draft status for titles
- [ ] Better title detail page with cast, creators, runtime and release date
- [ ] Genre and year filters
- [ ] Pagination or infinite scrolling
- [ ] Recently added section
- [ ] Watch history page
- [ ] Clear/remove individual items from Continue Watching
- [ ] “Mark as watched” and “Restart from beginning”
- [ ] Player quality selector for multi-rendition HLS
- [ ] Playback speed control
- [ ] Subtitle language selector
- [ ] “Skip intro” and “Skip recap” markers (configured per episode)
- [ ] Up Next countdown with cancel option
- [ ] Better empty, loading, offline and playback-error states

## Phase 2 — Personalization

- [ ] Profile avatars and editable profile names
- [ ] Profile-specific language and subtitle preferences
- [ ] Profile maturity/content restrictions
- [ ] Parental PIN for restricted profiles
- [ ] Personalized home rows based on watch history
- [ ] “Because you watched…” recommendations
- [ ] Similar titles on detail pages
- [ ] More like this / hide this title feedback
- [ ] Custom collections and watchlists
- [ ] Notifications for new episodes of followed series
- [ ] Favorite genres and preferred languages

## Phase 3 — Streaming and media capabilities

- [ ] Multi-quality HLS renditions (for example 480p, 720p and 1080p when source quality permits)
- [ ] Audio language and audio-track selection
- [ ] Multiple subtitle tracks and subtitle styling
- [ ] Intro/credits skip markers
- [ ] Resume sync across devices
- [ ] Casting support, if the target platform and media setup support it
- [ ] Offline downloads only if the licensing and device security model allow it
- [ ] CDN/object-storage integration
- [ ] Background media processing queue
- [ ] Media health checks for missing playlists, segments, posters and subtitles

## Phase 4 — Discovery and community

- [ ] Ratings and reviews
- [ ] User-curated public collections
- [ ] Trending by category and time period
- [ ] Top movies, top series and seasonal anime lists
- [ ] Advanced filters (genre, year, rating, language, duration)
- [ ] Editorial collections and featured playlists
- [ ] Content recommendations with an explanation of why an item is suggested

Add moderation, reporting, privacy controls and anti-spam measures before launching user-generated reviews or public collections.

## Phase 5 — Optional business features

Only consider these if Vortex is intended to become a public commercial service.

- [ ] Subscription plans and billing
- [ ] Account/device management
- [ ] Concurrent-stream limits
- [ ] Usage and service analytics
- [ ] Admin audit log
- [ ] Support/contact workflow
- [ ] Terms, privacy policy and content takedown process

Payments and public distribution require a clear legal/content-rights model and appropriate operational safeguards.

## Suggested first feature to implement

**Admin Dashboard** — it unlocks a manageable catalog and uses backend functionality that already exists. Build it before recommendations, reviews, subscriptions or social features.
