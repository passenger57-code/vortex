import hashlib
import hmac
import os
import posixpath
import re
import shutil
import subprocess
import time
import uuid
from urllib import request as url_request
from urllib.parse import quote, urlsplit

from flask import Blueprint, Response, current_app, jsonify, redirect, request, send_from_directory
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from werkzeug.utils import secure_filename

from extensions import db, limiter
from models import Episode, EpisodeMetadata, MediaAsset, Title
from routes.helpers import admin_required
from services.storage import StorageService

bp = Blueprint("media", __name__, url_prefix="/api/media")
MEDIA_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "media"))
ALLOWED_TYPES = {
    "poster": {"extensions": {".jpg", ".jpeg", ".png", ".webp"}, "max_size": 5 * 1024 * 1024},
    "backdrop": {"extensions": {".jpg", ".jpeg", ".png", ".webp"}, "max_size": 8 * 1024 * 1024},
    "subtitle": {"extensions": {".vtt"}, "max_size": 2 * 1024 * 1024},
    "video": {"extensions": {".mp4", ".m3u8", ".ts", ".webm", ".mov"}, "max_size": 2 * 1024 * 1024 * 1024},
}
EPISODE_FILENAME = re.compile(
    r"^(?P<title>.+?)[ ._-]+S(?P<season>\d{1,2})E(?P<number>\d{1,3})(?:[ ._-]+(?P<name>.+?))?$",
    re.IGNORECASE,
)


def _normalize_kind(kind):
    value = (kind or "poster").strip().lower()
    return value if value in ALLOWED_TYPES else "poster"


def _validate_upload(kind, upload):
    if not upload or not getattr(upload, "filename", None):
        raise ValueError("Please choose a file to upload.")
    allowed = ALLOWED_TYPES[kind]
    ext = os.path.splitext(secure_filename(upload.filename))[1].lower()
    if ext not in allowed["extensions"]:
        raise ValueError(f"Unsupported file type for {kind}. Allowed: {', '.join(sorted(allowed['extensions']))}")
    upload.stream.seek(0, os.SEEK_END)
    size = upload.stream.tell()
    upload.stream.seek(0)
    if size > allowed["max_size"]:
        raise ValueError(f"{kind} files must be smaller than {allowed['max_size'] // (1024 * 1024)} MB.")
    return size


def _save_upload(kind, upload, storage_provider=None, title_id=None, episode_id=None):
    provider = StorageService.normalize_provider(storage_provider)
    size = _validate_upload(kind, upload)

    if provider == "local":
        url, relative_path = StorageService.local_upload(kind, upload)
        bucket = None
    elif provider == "supabase":
        url, relative_path = StorageService.supabase_upload(kind, upload)
        bucket = current_app.config.get("SUPABASE_BUCKET", "vortex-media")
    else:
        raise ValueError(f"Unsupported storage provider '{provider}'.")

    asset = MediaAsset(
        title_id=title_id,
        episode_id=episode_id,
        storage_provider=provider,
        bucket_name=bucket,
        file_path=relative_path,
        file_type=kind,
        file_size=size,
        processing_status="ready",
    )
    db.session.add(asset)
    db.session.commit()
    return {"kind": kind, "provider": provider, "url": url, "asset_id": asset.id, "filename": os.path.basename(relative_path)}


def _signature(asset_id, object_path, expires):
    secret = current_app.config.get("JWT_SECRET_KEY") or current_app.config["SECRET_KEY"]
    message = f"{asset_id}:{object_path}:{expires}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _stream_url(asset_id, object_path, expires):
    path = quote(object_path, safe="/")
    return f"/api/media/stream/{asset_id}/{path}?expires={expires}&signature={_signature(asset_id, object_path, expires)}"


def _asset_root(asset):
    bucket = asset.bucket_name or ""
    if bucket.startswith("scan:"):
        try:
            root_index = int(bucket.split(":", 1)[1])
            roots = current_app.config.get("MEDIA_SCAN_ROOTS", [])
            root = roots[root_index]
        except (ValueError, IndexError, TypeError):
            return None
        return os.path.realpath(root)
    return os.path.abspath(current_app.config.get("MEDIA_ROOT") or MEDIA_ROOT)


def _safe_local_path(object_path, asset):
    root = _asset_root(asset)
    if not root:
        return None
    target = os.path.abspath(os.path.join(root, *object_path.split("/")))
    if os.path.commonpath([os.path.realpath(root), os.path.realpath(target)]) != os.path.realpath(root):
        return None
    return target


def _signed_hls_uri(asset, playlist_path, uri, expires):
    parts = urlsplit(uri)
    if parts.scheme or parts.netloc or not parts.path:
        return uri
    base = posixpath.dirname(playlist_path)
    object_path = posixpath.normpath(posixpath.join(base, parts.path))
    if object_path == ".." or object_path.startswith("../") or object_path.startswith("/"):
        raise ValueError("The HLS playlist contains a path outside its media directory.")
    if base and not object_path.startswith(base.rstrip("/") + "/"):
        raise ValueError("The HLS playlist contains a path outside its media directory.")
    return _stream_url(asset.id, object_path, expires)


def _rewrite_hls(asset, playlist_path, content, expires):
    lines = []
    for line in content.splitlines():
        if line.startswith("#"):
            line = re.sub(
                r'URI="([^"]+)"',
                lambda match: f'URI="{_signed_hls_uri(asset, playlist_path, match.group(1), expires)}"',
                line,
            )
        elif line.strip():
            line = _signed_hls_uri(asset, playlist_path, line.strip(), expires)
        lines.append(line)
    return "\n".join(lines) + "\n"


def _read_supabase_object(asset, object_path):
    base = current_app.config.get("SUPABASE_URL", "").rstrip("/")
    service_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not service_key:
        raise ValueError("Supabase storage is not configured.")
    bucket = quote(asset.bucket_name or current_app.config.get("SUPABASE_BUCKET", "vortex-media"), safe="")
    path = "/".join(quote(part, safe="") for part in object_path.split("/"))
    req = url_request.Request(
        f"{base}/storage/v1/object/{bucket}/{path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
        },
    )
    with url_request.urlopen(req, timeout=20) as response:
        return response.read()


def _no_store(response):
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@bp.get("/assets")
@admin_required
def list_media_assets():
    query = MediaAsset.query
    title_id = request.args.get("title_id", type=int)
    episode_id = request.args.get("episode_id", type=int)
    if title_id:
        query = query.filter_by(title_id=title_id)
    if episode_id:
        query = query.filter_by(episode_id=episode_id)
    return jsonify([asset.to_dict() for asset in query.order_by(MediaAsset.created_at.desc()).all()])


@bp.get("/scan-roots")
@admin_required
def list_scan_roots():
    roots = current_app.config.get("MEDIA_SCAN_ROOTS", [])
    return jsonify([
        {"id": index, "label": f"Configured library folder {index + 1}", "available": os.path.isdir(path)}
        for index, path in enumerate(roots)
    ])


@bp.post("/scan")
@admin_required
def scan_library():
    data = request.get_json(silent=True) or {}
    root_index = data.get("root_index")
    content_type = data.get("type")
    if content_type not in {"series", "anime"}:
        return jsonify(error="Choose Series or Anime for the scan."), 400
    try:
        root_index = int(root_index)
        if root_index < 0:
            raise ValueError()
        root = current_app.config.get("MEDIA_SCAN_ROOTS", [])[root_index]
    except (TypeError, ValueError, IndexError):
        return jsonify(error="Choose a configured library folder."), 400
    root = os.path.realpath(root)
    if not os.path.isdir(root):
        return jsonify(error="The configured library folder is unavailable."), 404

    created_titles = 0
    created_episodes = 0
    bucket = f"scan:{root_index}"
    allowed_extensions = {".mp4", ".mkv", ".webm", ".mov", ".m3u8"}
    for current_dir, directories, filenames in os.walk(root, followlinks=False):
        directories[:] = [
            name for name in directories
            if not os.path.islink(os.path.join(current_dir, name))
            and os.path.commonpath([root, os.path.realpath(os.path.join(current_dir, name))]) == root
        ]
        for filename in filenames:
            extension = os.path.splitext(filename)[1].lower()
            match = EPISODE_FILENAME.match(os.path.splitext(filename)[0])
            if extension not in allowed_extensions or not match:
                continue
            full_path = os.path.realpath(os.path.join(current_dir, filename))
            if os.path.commonpath([root, full_path]) != root or os.path.islink(os.path.join(current_dir, filename)):
                continue
            relative_path = os.path.relpath(full_path, root).replace(os.sep, "/")
            if MediaAsset.query.filter_by(storage_provider="local", bucket_name=bucket, file_path=relative_path).first():
                continue
            title_name = re.sub(r"[._-]+", " ", match.group("title")).strip()
            title = Title.query.filter(Title.type == content_type, func.lower(Title.title) == title_name.lower()).first()
            if not title:
                title = Title(type=content_type, title=title_name, description="")
                db.session.add(title)
                db.session.flush()
                created_titles += 1
            episode = Episode(
                title_id=title.id,
                season=int(match.group("season")),
                number=int(match.group("number")),
                name=re.sub(r"[._-]+", " ", (match.group("name") or f"Episode {match.group('number')}")).strip(),
                video_url=f"scan://{root_index}/{relative_path}",
            )
            db.session.add(episode)
            db.session.flush()
            db.session.add(EpisodeMetadata(episode_id=episode.id))
            db.session.add(MediaAsset(
                episode_id=episode.id,
                storage_provider="local",
                bucket_name=bucket,
                file_path=relative_path,
                file_type="video",
                file_size=os.path.getsize(full_path),
                processing_status="ready",
            ))
            created_episodes += 1
    db.session.commit()
    return jsonify(created_titles=created_titles, created_episodes=created_episodes, skipped_existing=True)


@bp.get("/assets/<int:asset_id>/playback")
@jwt_required()
def create_playback_url(asset_id):
    asset = db.session.get(MediaAsset, asset_id)
    if not asset or asset.processing_status != "ready" or asset.file_type not in {"video", "subtitle"}:
        return jsonify(error="Playable media asset not found."), 404
    lifetime = max(60, min(int(current_app.config.get("MEDIA_URL_TTL_SECONDS", 14400)), 86400))
    expires = int(time.time()) + lifetime
    return jsonify(url=_stream_url(asset.id, asset.file_path.replace("\\", "/"), expires), expires_at=expires)


@bp.post("/assets/<int:asset_id>/thumbnail")
@admin_required
def generate_thumbnail(asset_id):
    asset = db.session.get(MediaAsset, asset_id)
    if not asset or asset.file_type != "video" or asset.processing_status != "ready":
        return jsonify(error="Video asset not found."), 404
    if asset.storage_provider != "local":
        return jsonify(error="Thumbnail generation currently supports local-server video assets only."), 400
    source = _safe_local_path(asset.file_path.replace("\\", "/"), asset)
    if not source or not os.path.isfile(source):
        return jsonify(error="The source video is unavailable."), 404
    ffmpeg = shutil.which(current_app.config.get("FFMPEG_BIN", "ffmpeg"))
    if not ffmpeg:
        return jsonify(error="FFmpeg is not installed or FFMPEG_BIN is invalid."), 503

    media_root = os.path.abspath(current_app.config.get("MEDIA_ROOT") or MEDIA_ROOT)
    output_dir = os.path.join(media_root, "thumbnail")
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    output_path = os.path.join(output_dir, filename)
    try:
        result = subprocess.run(
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-ss", "00:00:10", "-i", source, "-frames:v", "1", "-q:v", "3", output_path],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return jsonify(error="FFmpeg thumbnail generation timed out."), 504
    if result.returncode != 0 or not os.path.isfile(output_path):
        if os.path.isfile(output_path):
            os.remove(output_path)
        return jsonify(error="FFmpeg could not generate a thumbnail from this file."), 422

    relative_path = f"thumbnail/{filename}"
    thumbnail = MediaAsset(
        title_id=asset.title_id,
        episode_id=asset.episode_id,
        storage_provider="local",
        file_path=relative_path,
        file_type="thumbnail",
        file_size=os.path.getsize(output_path),
        processing_status="ready",
    )
    db.session.add(thumbnail)
    if asset.episode_id:
        episode = db.session.get(Episode, asset.episode_id)
        if episode:
            episode.thumbnail_url = f"/media/{relative_path}"
    elif asset.title_id:
        title = db.session.get(Title, asset.title_id)
        if title and not title.backdrop_url:
            title.backdrop_url = f"/media/{relative_path}"
    db.session.commit()
    return jsonify(url=f"/media/{relative_path}", asset_id=thumbnail.id), 201


@bp.get("/stream/<int:asset_id>/<path:object_path>")
@limiter.exempt
def stream_media(asset_id, object_path):
    expires = request.args.get("expires", type=int)
    signature = request.args.get("signature", "")
    normalized_path = object_path.replace("\\", "/")
    if not expires or expires < int(time.time()) or not hmac.compare_digest(
        _signature(asset_id, normalized_path, expires), signature
    ):
        return jsonify(error="This media link is invalid or expired. Reload the player to get a new link."), 403

    asset = db.session.get(MediaAsset, asset_id)
    if not asset or asset.processing_status != "ready" or asset.file_type not in {"video", "subtitle"}:
        return jsonify(error="Playable media asset not found."), 404
    root_path = asset.file_path.replace("\\", "/")
    if normalized_path != root_path and not normalized_path.startswith(posixpath.dirname(root_path).rstrip("/") + "/"):
        return jsonify(error="The requested file is outside this media asset."), 403

    is_playlist = normalized_path.lower().endswith(".m3u8")
    if asset.storage_provider == "local":
        local_path = _safe_local_path(normalized_path, asset)
        if not local_path or not os.path.isfile(local_path):
            return jsonify(error="Media file not found."), 404
        if is_playlist:
            with open(local_path, "r", encoding="utf-8") as media_file:
                try:
                    content = _rewrite_hls(asset, normalized_path, media_file.read(), expires)
                except (UnicodeDecodeError, ValueError) as exc:
                    return jsonify(error=str(exc)), 400
            return _no_store(Response(content, mimetype="application/vnd.apple.mpegurl"))
        response = send_from_directory(_asset_root(asset), normalized_path, conditional=True)
        return _no_store(response)

    if asset.storage_provider != "supabase":
        return jsonify(error="Unsupported media storage provider."), 400
    if is_playlist:
        try:
            content = _read_supabase_object(asset, normalized_path).decode("utf-8")
            content = _rewrite_hls(asset, normalized_path, content, expires)
        except (OSError, UnicodeDecodeError, ValueError) as exc:
            current_app.logger.exception("Unable to load HLS playlist for asset %s", asset.id)
            return jsonify(error=f"Unable to load HLS playlist: {exc}"), 502
        return _no_store(Response(content, mimetype="application/vnd.apple.mpegurl"))

    try:
        target_url = StorageService.supabase_signed_url(asset.bucket_name or current_app.config.get("SUPABASE_BUCKET", "vortex-media"), normalized_path, max(1, expires - int(time.time())))
    except ValueError as exc:
        return jsonify(error=str(exc)), 502
    return _no_store(redirect(target_url, code=302))


@bp.post("/upload")
@admin_required
def upload_media():
    if "file" not in request.files:
        return jsonify(error="No file uploaded."), 400

    kind = _normalize_kind(request.form.get("kind"))
    storage_provider = request.form.get("storage_provider", "local")
    title_id = request.form.get("title_id", type=int)
    episode_id = request.form.get("episode_id", type=int)

    try:
        payload = _save_upload(kind, request.files["file"], storage_provider=storage_provider, title_id=title_id, episode_id=episode_id)
    except ValueError as exc:
        return jsonify(error=str(exc)), 400

    return jsonify(payload), 201
