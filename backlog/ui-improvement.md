# Vortex — UI Improvements

> UI-focused review of the uploaded Vortex frontend source. This document describes the current interface and proposes improvements. The recommendations are not implemented changes.

## 1. Current UI direction

The project already has a recognizable streaming-platform visual identity:

- Dark navy/near-black backgrounds (`#02050b`, `#0a1220`, `#101b2e`).
- Blue accent color (`#1f8bff`) with cyan focus accents.
- Exo 2 display typography and DM Sans body typography.
- A fixed top navigation bar with Vortex branding, browse links, search and profile menu.
- A large featured-title billboard with artwork, metadata, description, Play and More Info actions.
- Horizontally scrolling content rows with hover-expanding title cards.
- Dedicated Search, My List, Profiles, Auth and Watch pages.
- Framer Motion is used for the featured billboard entrance animation.
- The video player uses native video controls, with an episode drawer for series/anime.

The recommendations below retain this black/navy + blue/cyan identity rather than proposing a complete redesign.

---

## 2. Highest-priority UI improvements

### P0 — Improve navigation clarity and usability

**Current:** `Navbar.jsx` provides Home, Series, Movies, Anime and My List links on desktop. On smaller screens, these links are grouped under a Browse menu. Search and profile controls sit on the right.

**Improve:**
- Give the active navigation link a clear blue indicator (small underline, pill background or left-to-right animated marker), not just a font-weight/color change.
- Add a subtle translucent navy surface and consistent border when the navbar becomes solid after scrolling.
- Make the mobile Browse menu close after a link is selected and ensure it is easy to dismiss.
- Add visible keyboard focus styles to all navbar actions.
- Add a clearer expanded search state on mobile so the input does not feel cramped beside the profile control.
- Add a small tooltip or accessible label to icon-only controls.
- Keep the profile menu aligned to the viewport on narrow screens so it cannot overflow.

**Acceptance criteria:**
- Active route is obvious at a glance.
- All navigation actions work by keyboard and touch.
- Menus do not overflow the viewport.
- Search remains usable on small screens.

### P0 — Make title cards easier to use on touch devices

**Current:** `TitleCard.jsx` expands on hover/focus and reveals Play, My List and More Info controls. The card is sized responsively and displays a progress bar when viewing progress exists.

**Improve:**
- Do not make essential actions available only through hover. On touch screens, provide a visible compact action row or open the info modal when the card is tapped, with actions available inside it.
- Add a stronger selected/focus state for keyboard navigation.
- Add a short, consistent transition for card scale and shadow; avoid layout jumps that cover neighboring content unexpectedly.
- Keep the poster/backdrop visible while the overlay appears.
- Add a fallback for missing or broken artwork (the existing `Art.jsx` fallback can be retained).
- Show a small “Continue” or “Resume” label on cards with saved progress.
- Make the progress bar more readable and add an accessible text description of progress.

**Acceptance criteria:**
- Users can reach Play, My List and More Info on mouse, keyboard and touch.
- Card expansion does not clip behind adjacent rows or the viewport.
- Missing artwork still looks intentional.

### P1 — Refine the featured billboard

**Current:** `Billboard.jsx` uses a 78vh hero, backdrop artwork, dark gradients, metadata, title, description and Play/More Info buttons.

**Improve:**
- Add a responsive height range so the billboard does not dominate short laptop screens or become too small on large displays.
- Improve text width and line spacing for long titles and descriptions.
- Add a subtle text scrim behind the copy when the artwork is bright or busy.
- Keep Play as the primary action and More Info as the secondary action, with consistent button heights and focus states.
- Add a clear loading skeleton that resembles the final hero layout.
- Add an intentional empty/failure state when the featured endpoint has no result, rather than leaving unexplained blank space.
- On mobile, position the copy lower and ensure buttons wrap without covering the title artwork.

**Acceptance criteria:**
- Hero content remains legible across bright and dark artwork.
- No important content is cut off at common mobile, tablet and desktop sizes.
- Loading and no-featured-title states look deliberate.

### P1 — Improve browse page hierarchy

**Current:** `Browse.jsx` places the Billboard first, then rows such as Continue Watching, My List and backend-provided browse categories.

**Improve:**
- Add consistent vertical spacing between rows and a predictable title/row hierarchy.
- Make the first row begin at a deliberate distance below the billboard gradient.
- Give each row heading a consistent font size, weight and optional “See all” action where a full category page exists.
- Add a “Recently Added” row if the API can provide the data.
- Avoid rendering empty rows; show a helpful page-level empty state only when the entire catalog is empty.
- Add skeleton cards that match the actual card dimensions instead of generic bars.
- Add a retry action when browse data fails to load.
- Preserve horizontal scrolling on touch and provide clear arrow controls on desktop.

**Acceptance criteria:**
- Browse pages have consistent spacing and hierarchy.
- Empty categories do not create awkward gaps.
- API failures are recoverable from the interface.

### P1 — Improve Search and My List screens

**Current:** `Search.jsx` shows results in a responsive grid and has basic no-match/instruction text. `MyList.jsx` shows a responsive grid and an empty-state message.

**Improve Search:**
- Add filter chips for Movies, Series and Anime if the API supports type filtering.
- Show a loading state while results are being fetched.
- Add a clear query action and a “No results” suggestion.
- Keep the query visible in the page heading.
- Consider a result count once the API provides reliable pagination/count data.
- Add an explicit error state instead of silently turning every request failure into an empty result.

**Improve My List:**
- Add a small description under the page title.
- Add sort options such as Recently Added and A–Z if the data supports them.
- Improve the empty state with a simple Vortex-branded visual and a Browse action.
- Add a visible remove-from-list action that is usable on touch devices.

**Acceptance criteria:**
- Loading, empty, error and populated states are visually distinct.
- Search failures are not mistaken for “no matches”.
- Users can manage saved titles on touch devices.

### P1 — Polish Profiles and Authentication

**Current:** `Profiles.jsx` shows profile tiles, an Add Profile flow and Manage Profiles mode. `Auth.jsx` provides sign-in/register UI.

**Improve Profiles:**
- Use a consistent set of profile avatar treatments (color, gradient or selectable avatar) rather than relying only on the first letter.
- Add an animated but restrained hover/focus outline.
- Make delete mode visually obvious and provide a confirmation before deleting a profile.
- Explain the profile limit when the maximum number has been reached.
- Improve small-screen spacing when several profiles wrap to multiple rows.

**Improve Auth:**
- Add clear field labels, password visibility toggle and inline validation messages.
- Keep form errors near the relevant field and preserve non-sensitive form values after an error.
- Add loading/disabled button states while a request is running.
- Ensure keyboard focus order and contrast are clear.
- Keep the auth panel visually consistent with the dark blue brand.

**Acceptance criteria:**
- Users understand which profile is selected or being deleted.
- Authentication errors are actionable.
- Forms are usable without a mouse.

---

## 3. Watch page and player UI

**Current:** `Watch.jsx` provides a full-screen player, back action, title/episode information, an Episodes drawer, a near-end Next Episode action and keyboard shortcuts. `VideoPlayer.jsx` currently renders the browser's native video controls and a subtitle track.

**Improve:**
- Add a branded loading state while media metadata is loading.
- Make playback errors more useful: show a concise message and Retry action, and distinguish missing media from a playback failure.
- Improve the episode drawer with episode thumbnails, watched/current indicators and clearer season selection.
- Add an explicit close/back control with a larger touch target.
- Add an Up Next panel with a visible countdown and Cancel option rather than only a Next Episode button near the end.
- Add a player settings panel for quality, playback speed and subtitle selection when those options are supported by the media source.
- Show a brief confirmation when progress is saved only if it does not distract from playback.
- Ensure controls remain visible when using keyboard navigation and touch.
- Add responsive sizing for the episode drawer on phones.
- Keep native controls until a custom player UI has equivalent accessibility and browser support.

**Acceptance criteria:**
- A viewer can recover from a failed stream without refreshing the whole app.
- Episode selection and next-episode behavior are understandable.
- Player controls work with keyboard, mouse and touch.

---

## 4. New UI screens worth designing

These screens are not currently registered in `App.jsx` and should be treated as new work.

### Admin Dashboard
- Overview cards for movie, series, anime and episode totals.
- Catalog table with search, filters and pagination.
- Create/edit title form with poster/backdrop preview.
- Season and episode manager.
- Upload/processing status for media and subtitles.
- Confirmation dialogs for destructive actions.
- Clear permission-denied screen for non-admin accounts.

### Title Details Page
- Large backdrop and poster.
- Title, year, maturity rating, runtime and genres.
- Synopsis and available metadata.
- Play/Resume and Add to My List actions.
- Season/episode list for series and anime.
- Related titles row.

The current project uses an Info Modal for title details; a dedicated page is optional and should only be added if the detail experience becomes too large for the modal.

### Settings
- Profile preferences.
- Default subtitle language and playback preferences.
- Appearance preferences if light/dark mode is introduced.
- Account/session controls.

### Watch History
- Recently watched titles.
- Resume progress.
- Remove an item from history.
- Clear history with confirmation.

---

## 5. Visual design system improvements

Keep the existing palette and formalize it into reusable tokens.

| Role | Current value | UI guidance |
|---|---|---|
| Main background | `#02050b` | Keep as the primary page background |
| Panel | `#0a1220` | Cards, menus and dialogs |
| Raised surface | `#101b2e` | Hovered/selected surfaces |
| Border | `#1a2a45` | Subtle separators |
| Primary blue | `#1f8bff` | Primary actions and active states |
| Cyan focus | `#3fd2ff` | Keyboard focus and small highlights |
| Main text | `#eef3ff` | Titles and important content |
| Muted text | `#8c9bb5` | Metadata and supporting text |

Additional design rules:
- Use one consistent radius scale for cards, buttons, inputs and dialogs.
- Use consistent spacing increments rather than one-off padding values.
- Use the same button heights for primary and secondary actions.
- Keep blue glow effects subtle; reserve strong glow for selected states or key actions.
- Maintain strong text contrast over artwork.
- Use motion to communicate state changes, not as decoration on every element.
- Respect `prefers-reduced-motion`; the project already includes a reduced-motion rule in `index.css`.
- Define reusable styles for buttons, inputs, badges, skeletons, empty states and dialogs.

---

## 6. Responsive design checklist

Test each main screen at approximately these viewport widths:

- [ ] 360px — small phone
- [ ] 390px — typical phone
- [ ] 768px — tablet portrait
- [ ] 1024px — small laptop/tablet landscape
- [ ] 1366px — common laptop
- [ ] 1920px — desktop

Check:
- [ ] Navbar controls do not collide or overflow.
- [ ] Hero text and buttons fit.
- [ ] Cards remain readable and actionable without hover.
- [ ] Horizontal rows scroll smoothly with touch.
- [ ] Search and My List grids use sensible column counts.
- [ ] Profile tiles wrap cleanly.
- [ ] Modals and drawers fit within the viewport.
- [ ] Player controls and episode drawer remain accessible.

---

## 7. Suggested implementation order

1. **Navigation polish** — active state, mobile menu, responsive search and focus behavior.
2. **Title card interaction** — touch-friendly actions, progress label and focus state.
3. **Browse page states** — skeletons, empty states, retry and row spacing.
4. **Search and My List polish** — loading/error states, filters and empty-state actions.
5. **Auth and Profiles polish** — validation, loading, profile avatars and delete confirmation.
6. **Watch page polish** — player errors, episode drawer and Up Next experience.
7. **Admin Dashboard UI** — new protected admin area connected to the existing admin API.
8. **Visual QA** — test the viewport checklist and keyboard accessibility.

## 8. First UI task to implement

Start with **Navbar.jsx** and **TitleCard.jsx**.

These components are visible throughout the main viewing experience, so improvements here have a high impact without requiring a backend redesign.

Recommended first pass:
- Add a polished active-link indicator to the navbar.
- Improve mobile search/menu behavior.
- Make title-card actions accessible on touch.
- Add clear keyboard focus states.
- Test the Home, Movies, Series, Anime, My List and Search flows at desktop and mobile widths.

Do not redesign every page at once. Improve one shared component, verify it, then move to the next.
