# Vortex — Media storage and upload architecture

This document records the recommended media-storage approach for Vortex before implementation. It is a product/design plan, not a completed implementation.

## 1. Recommended storage options

### Option A — Supabase Cloud Storage (recommended)

Use Supabase Storage for production media hosting and keep Vortex as the application layer that authorizes access, organizes catalog metadata, and streams media.

Recommended model:
- Upload movies, anime and episodes from a laptop or admin workstation.
- Store media files in Supabase Storage.
- Store catalog entries and file references in PostgreSQL.
- Stream content through the Vortex app.
- Access the library from multiple devices without depending on a local machine.

Benefits:
- Better portability and simpler remote access.
- No need to keep a developer laptop or local server online for normal playback.
- Simplifies deployment and scaling when the library grows.
- Works well with browser-to-storage uploads for large files.

### Option B — Local device or local server storage

Keep media on a local machine or private server when that is the operational preference.

Recommended model:
- Select videos from a laptop or local workstation.
- Upload them through Vortex.
- Save them to a local server or a network-attached storage device.
- Stream them through Vortex while the server remains online.

Trade-offs:
- Playback depends on the server being reachable.
- Local storage is not ideal for multi-device or remote access.
- It is more operationally fragile than cloud-backed storage.

Important distinction:
- Uploading a file from your laptop does not require the original file to remain stored locally.
- The upload can be sent directly to Supabase Storage and only the resulting cloud URL remains in the system.

## 2. Recommended architecture

Keep the current React + Flask architecture and add Supabase Storage as the media layer.

Vortex media architecture:

- Vortex React Frontend
  - Browse
  - Upload
  - Search
  - Watch

- Flask Backend
  - Authentication
  - API logic
  - Permissions
  - Upload authorization
  - Playback URL generation

- Supabase
  - PostgreSQL metadata
  - Storage media files

- Local Storage
  - Videos and artwork on a self-hosted server when selected

- Vortex Video Player
  - MP4
  - HLS
  - Subtitles
  - Continue Watching

The Flask backend should decide where a file is stored and then provide the correct playback URL to the client. It should also enforce authorization and protect signed/private storage access.

## 3. Recommended Media Library admin flow

Introduce a new admin section called Media Library in the Vortex Admin Dashboard.

Possible admin actions:
- Upload Movie
- Upload Anime
- Upload Series
- Upload Episode
- Select storage destination

Example selection controls:
- Content type
  - Movie
  - Anime
  - Series
- Storage destination
  - Supabase Cloud
  - Local Server
- Video file
  - Select a video file
  - Allowed types: MP4, MKV, WebM, HLS (where supported)

Example configuration summary:
- Anime · Supabase Cloud

This is a UI concept, not a connected upload form.

## 4. Upload and streaming flow

### For Supabase

1. An administrator selects a video from a laptop.
2. Vortex requests a secure upload authorization from Flask.
3. Flask creates a signed or otherwise authorized upload URL.
4. The browser uploads directly to Supabase Storage.
5. Flask stores the file path and metadata in PostgreSQL.
6. Vortex displays the newly uploaded title or episode.
7. When playback is requested, Flask authorizes the request and supplies the correct URL.
8. The video player streams the media to the viewer.

This direct browser-to-storage upload pattern is preferable for large video files because it avoids sending the full file through Flask.

### For HLS

Use the existing FFmpeg conversion helper to generate playlists and segments, then store them in Supabase Storage or in a configured local media folder.

## 5. Recommended database model

Introduce a media-assets table that links the catalog to the physical files.

Suggested fields:

- id
  - Media record ID
- title_id
  - Related movie, series or anime
- episode_id
  - Related episode when applicable
- storage_provider
  - Supabase or local
- bucket_name
  - Supabase bucket name
- file_path
  - Object path or local file path
- file_type
  - MP4, HLS, subtitle, poster, backdrop
- file_size
  - File size in bytes
- processing_status
  - Upload, processing, ready, failed

Recommended approach:
- Keep separate media records for posters, backdrops, subtitles and video renditions.
- Keep a single title or episode record, but allow multiple media records associated with it.
- Allow the same title to have multiple video renditions and multiple subtitle tracks.

## 6. Important production considerations

- Storage quotas: Supabase includes quota and file-size limits based on plan and region.
- Bandwidth costs: streaming large libraries can cause significant egress costs.
- Transcoding: Supabase Storage stores files; it does not replace FFmpeg or a dedicated transcoding pipeline.
- Security: keep Supabase service-role credentials on the Flask backend only; use private buckets with signed URLs or equivalent authorized access.
- Local storage: a local server must remain online and reachable for remote viewing.
- Copyright: only upload media you own or are authorized to distribute.

## 7. Recommended development order

1. Connect Supabase to the existing Flask backend.
2. Configure Supabase Storage buckets.
3. Create the media-assets database model.
4. Build the Media Library admin interface.
5. Implement local-device uploads to Supabase.
6. Implement local-server storage as an alternative.
7. Connect media records to titles, series and episodes.
8. Connect secure playback URLs to the existing Vortex video player.
9. Test MP4, HLS and subtitles.
10. Add upload progress, processing status and error handling.

## 8. Recommended default

Make Supabase the default storage destination, while allowing an administrator to choose Local Server during upload. This keeps the app flexible without forcing the viewing experience to depend on the origin of each file.

## 9. Implementation note

This design should be implemented as a separate storage feature layer behind the existing API and admin UI, not by changing the core Vortex React + Flask app structure.
