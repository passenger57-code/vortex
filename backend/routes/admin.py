import json
import math
from datetime import datetime, timezone
from flask import Blueprint, current_app, request, jsonify
from sqlalchemy import case, func
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from extensions import db
from models import (
    ContentReport, Episode, EpisodeMetadata, Favorite, Genre, MediaAsset,
    EpisodeSegments, PlaybackEvent, Progress, Title, TitleMetadata, TitleRating, TitleStudio, User, WatchedEpisode,
)
from routes.helpers import admin_required

bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def slugify(s):
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def genre_objs(names):
    out = []
    for n in names or []:
        n = n.strip()
        if not n:
            continue
        g = Genre.query.filter_by(slug=slugify(n)).first() or Genre(name=n, slug=slugify(n))
        out.append(g)
    return out


FIELDS = ("type", "title", "description", "year", "maturity", "duration", "poster_url",
          "backdrop_url", "video_url", "subtitle_url", "featured", "popularity")


def _link_title_assets(title, data):
    for field, kind in (("video_asset_id", "video"), ("subtitle_asset_id", "subtitle")):
        if field not in data:
            continue
        asset_id = data.get(field)
        assets = MediaAsset.query.filter_by(title_id=title.id, file_type=kind).all() if title.id else []
        if asset_id in (None, ""):
            for asset in assets:
                asset.title_id = None
            continue
        try:
            asset_id = int(asset_id)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be a valid media asset ID.")
        asset = db.session.get(MediaAsset, asset_id)
        if not asset or asset.file_type != kind or asset.episode_id or asset.title_id not in (None, title.id):
            raise ValueError(f"The selected {kind} asset is unavailable or already linked.")
        for existing in assets:
            if existing.id != asset.id:
                existing.title_id = None
        asset.title_id = title.id


def _update_title_metadata(title, data):
    fields = {"airing_status", "audio_mode", "publish_at", "trailer_url", "franchise_name", "theme_color", "attribution", "cast"}
    if not fields.intersection(data):
        return
    metadata = title.extra or TitleMetadata(title_id=title.id)
    if "airing_status" in data:
        status = (data.get("airing_status") or "completed").strip().lower()
        if status not in {"airing", "completed", "upcoming"}:
            raise ValueError("airing_status must be airing, completed, or upcoming.")
        metadata.airing_status = status
    if "audio_mode" in data:
        audio_mode = (data.get("audio_mode") or "sub").strip().lower()
        if audio_mode not in {"sub", "dub", "both"}:
            raise ValueError("audio_mode must be sub, dub, or both.")
        metadata.audio_mode = audio_mode
    if "publish_at" in data:
        value = data.get("publish_at")
        try:
            published = datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None
        except (AttributeError, ValueError):
            raise ValueError("publish_at must be a valid ISO-8601 datetime.")
        if published and published.tzinfo is None:
            published = published.replace(tzinfo=timezone.utc)
        metadata.publish_at = published
    if "trailer_url" in data:
        metadata.trailer_url = (data.get("trailer_url") or "").strip()[:500] or None
    if "franchise_name" in data:
        metadata.franchise_name = (data.get("franchise_name") or "").strip()[:120] or None
    if "theme_color" in data:
        color = (data.get("theme_color") or "").strip()
        if color and (len(color) != 7 or not color.startswith("#") or any(char not in "0123456789abcdefABCDEF" for char in color[1:])):
            raise ValueError("theme_color must be a 6-digit hex color.")
        metadata.theme_color = color or None
    if "attribution" in data:
        metadata.attribution = (data.get("attribution") or "").strip()[:120] or None
    if "cast" in data:
        cast = data.get("cast") or []
        if not isinstance(cast, list):
            raise ValueError("cast must be a list of names.")
        metadata.cast_names = ", ".join(str(name).strip()[:100] for name in cast[:30] if str(name).strip()) or None
    db.session.add(metadata)


def _update_title_studios(title, data):
    if "studios" not in data:
        return
    names = data.get("studios") or []
    if not isinstance(names, list):
        raise ValueError("studios must be a list of names.")
    normalized = {}
    for name in names[:30]:
        if not isinstance(name, str):
            raise ValueError("Studio names must be text.")
        name = name.strip()[:120]
        slug = slugify(name)
        if name and slug:
            normalized[slug] = name
    for studio in list(title.studios):
        if studio.slug not in normalized:
            title.studios.remove(studio)
    existing = {studio.slug for studio in title.studios}
    for slug, name in normalized.items():
        if slug not in existing:
            title.studios.append(TitleStudio(name=name, slug=slug))


def _update_episode_segments(episode, data):
    fields = ("intro_start", "intro_end", "recap_start", "recap_end", "credits_start")
    if not any(field in data for field in fields):
        return
    segments = episode.segments or EpisodeSegments(episode_id=episode.id)
    for field in fields:
        if field not in data:
            continue
        value = data[field]
        if value in (None, ""):
            setattr(segments, field, None)
            continue
        if isinstance(value, bool):
            raise ValueError(f"{field} must be a non-negative time in seconds.")
        try:
            seconds = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{field} must be a non-negative time in seconds.")
        if not math.isfinite(seconds) or seconds < 0:
            raise ValueError(f"{field} must be a non-negative time in seconds.")
        setattr(segments, field, seconds)
    for start, end, label in (
        ("intro_start", "intro_end", "intro"),
        ("recap_start", "recap_end", "recap"),
    ):
        start_value, end_value = getattr(segments, start), getattr(segments, end)
        if (start_value is None) != (end_value is None) or (
            start_value is not None and end_value <= start_value
        ):
            raise ValueError(f"{label} start and end must both be set, with end after start.")
    db.session.add(segments)


def _external_json(url, payload=None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "Vortex/1.0"},
        method="POST" if body is not None else "GET",
    )
    with urlopen(req, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


@bp.get("/titles")
@admin_required
def list_admin_titles():
    limit = min(max(request.args.get("limit", 300, type=int), 1), 500)
    items = Title.query.order_by(Title.created_at.desc(), Title.id.desc()).limit(limit).all()
    return jsonify([title.to_dict() for title in items])


@bp.post("/metadata/tmdb")
@admin_required
def import_tmdb_metadata():
    if not current_app.config.get("TMDB_API_KEY"):
        return jsonify(error="TMDB import is not configured. Set TMDB_API_KEY on the backend."), 503
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    kind = data.get("type")
    if not query or kind not in {"movie", "series"}:
        return jsonify(error="Provide a title query and choose Movie or Series."), 400
    endpoint = "movie" if kind == "movie" else "tv"
    key = current_app.config["TMDB_API_KEY"]
    search_url = f"https://api.themoviedb.org/3/search/{endpoint}?{urlencode({'api_key': key, 'query': query})}"
    try:
        results = _external_json(search_url).get("results") or []
        if not results:
            return jsonify(error="TMDB found no matching titles."), 404
        result = results[0]
        details_url = f"https://api.themoviedb.org/3/{endpoint}/{result['id']}?{urlencode({'api_key': key, 'append_to_response': 'credits,videos'})}"
        details = _external_json(details_url)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
        current_app.logger.exception("TMDB metadata request failed.")
        return jsonify(error=f"TMDB metadata could not be loaded: {exc}"), 502

    date_value = details.get("release_date") or details.get("first_air_date") or ""
    videos = (details.get("videos") or {}).get("results") or []
    trailer = next((video for video in videos if video.get("site") == "YouTube" and video.get("type") == "Trailer"), None)
    cast = [person.get("name") for person in (details.get("credits") or {}).get("cast", [])[:10] if person.get("name")]
    return jsonify({
        "title": details.get("title") or details.get("name") or result.get("title") or result.get("name"),
        "description": details.get("overview") or "",
        "year": int(date_value[:4]) if date_value[:4].isdigit() else None,
        "poster_url": f"https://image.tmdb.org/t/p/w500{details['poster_path']}" if details.get("poster_path") else "",
        "backdrop_url": f"https://image.tmdb.org/t/p/w1280{details['backdrop_path']}" if details.get("backdrop_path") else "",
        "genres": [genre["name"] for genre in details.get("genres", []) if genre.get("name")],
        "studios": [company["name"] for company in details.get("production_companies", []) if company.get("name")],
        "cast": cast,
        "trailer_url": f"https://www.youtube.com/watch?v={trailer['key']}" if trailer else "",
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    })


@bp.post("/metadata/anilist")
@admin_required
def import_anilist_metadata():
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify(error="Enter an anime title to search AniList."), 400
    graphql = """
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          title { romaji english }
          description(asHtml: false)
          seasonYear
          coverImage { extraLarge }
          bannerImage
          genres
          status
          trailer { site id }
          studios { nodes { name } }
          staff(perPage: 10, sort: RELEVANCE) { edges { node { name { full } } } }
        }
      }
    """
    try:
        media = (_external_json("https://graphql.anilist.co", {"query": graphql, "variables": {"search": query}}).get("data") or {}).get("Media")
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        current_app.logger.exception("AniList metadata request failed.")
        return jsonify(error=f"AniList metadata could not be loaded: {exc}"), 502
    if not media:
        return jsonify(error="AniList found no matching anime."), 404
    trailer = media.get("trailer") or {}
    trailer_url = f"https://www.youtube.com/watch?v={trailer['id']}" if trailer.get("site") == "youtube" and trailer.get("id") else ""
    staff = [edge.get("node", {}).get("name", {}).get("full") for edge in (media.get("staff") or {}).get("edges", [])]
    return jsonify({
        "title": (media.get("title") or {}).get("english") or (media.get("title") or {}).get("romaji"),
        "description": media.get("description") or "",
        "year": media.get("seasonYear"),
        "poster_url": ((media.get("coverImage") or {}).get("extraLarge") or ""),
        "backdrop_url": media.get("bannerImage") or "",
        "genres": media.get("genres") or [],
        "studios": [studio.get("name") for studio in (media.get("studios") or {}).get("nodes", []) if studio.get("name")],
        "cast": [name for name in staff if name],
        "trailer_url": trailer_url,
        "airing_status": {"RELEASING": "airing", "FINISHED": "completed", "NOT_YET_RELEASED": "upcoming"}.get(media.get("status"), "completed"),
        "attribution": "Anime metadata provided by AniList.",
    })


@bp.get("/titles/<int:tid>")
@admin_required
def get_admin_title(tid):
    title = db.session.get(Title, tid)
    if not title:
        return jsonify(error="Title not found."), 404
    return jsonify(title.to_dict(detail=True))


@bp.post("/titles")
@admin_required
def create_title():
    d = request.get_json(silent=True) or {}
    if d.get("type") not in ("movie", "series", "anime") or not d.get("title"):
        return jsonify(error="type (movie|series|anime) and title are required."), 400
    if d["type"] == "movie" and not d.get("video_url"):
        return jsonify(error="Movies need a video_url."), 400
    t = Title(**{k: d[k] for k in FIELDS if k in d})
    t.genres = genre_objs(d.get("genres"))
    db.session.add(t)
    db.session.commit()
    try:
        _update_title_metadata(t, d)
        _update_title_studios(t, d)
        _link_title_assets(t, d)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        db.session.delete(t)
        db.session.commit()
        return jsonify(error=str(exc)), 400
    return jsonify(t.to_dict(detail=True)), 201


@bp.put("/titles/<int:tid>")
@admin_required
def update_title(tid):
    t = db.session.get(Title, tid)
    if not t:
        return jsonify(error="Title not found."), 404
    d = request.get_json(silent=True) or {}
    for k in FIELDS:
        if k in d:
            setattr(t, k, d[k])
    if "genres" in d:
        t.genres = genre_objs(d["genres"])
    try:
        _update_title_metadata(t, d)
        _update_title_studios(t, d)
        _link_title_assets(t, d)
    except ValueError as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 400
    db.session.commit()
    return jsonify(t.to_dict(detail=True))


@bp.delete("/titles/<int:tid>")
@admin_required
def delete_title(tid):
    t = db.session.get(Title, tid)
    if not t:
        return jsonify(error="Title not found."), 404
    episode_ids = [episode.id for episode in t.episodes]
    Favorite.query.filter_by(title_id=tid).delete(synchronize_session=False)
    Progress.query.filter_by(title_id=tid).delete(synchronize_session=False)
    TitleRating.query.filter_by(title_id=tid).delete(synchronize_session=False)
    WatchedEpisode.query.filter_by(title_id=tid).delete(synchronize_session=False)
    PlaybackEvent.query.filter_by(title_id=tid).delete(synchronize_session=False)
    ContentReport.query.filter_by(title_id=tid).delete(synchronize_session=False)
    MediaAsset.query.filter_by(title_id=tid).delete(synchronize_session=False)
    if episode_ids:
        MediaAsset.query.filter(MediaAsset.episode_id.in_(episode_ids)).delete(synchronize_session=False)
    db.session.delete(t)
    db.session.commit()
    return jsonify(ok=True)


@bp.post("/titles/<int:tid>/episodes")
@admin_required
def add_episode(tid):
    t = db.session.get(Title, tid)
    if not t or t.type == "movie":
        return jsonify(error="Series or anime title not found."), 404
    d = request.get_json(silent=True) or {}
    if not d.get("name") or (not d.get("video_url") and not d.get("video_asset_id")):
        return jsonify(error="name and a video URL or uploaded video asset are required."), 400
    audio_mode = (d.get("audio_mode") or "").strip().lower()
    if audio_mode and audio_mode not in {"sub", "dub", "both"}:
        return jsonify(error="audio_mode must be sub, dub, or both."), 400
    ep = Episode(title_id=tid, season=d.get("season", 1), number=d.get("number", len(t.episodes) + 1),
                 name=d["name"], description=d.get("description", ""), duration=d.get("duration"),
                 video_url=d.get("video_url") or "", thumbnail_url=d.get("thumbnail_url"),
                 subtitle_url=d.get("subtitle_url"))
    db.session.add(ep)
    db.session.flush()
    if d.get("video_asset_id"):
        try:
            asset = db.session.get(MediaAsset, int(d["video_asset_id"]))
        except (TypeError, ValueError):
            db.session.rollback()
            return jsonify(error="video_asset_id must be a valid media asset ID."), 400
        if not asset or asset.file_type != "video" or asset.episode_id or asset.title_id not in (None, tid):
            db.session.rollback()
            return jsonify(error="The selected video asset is unavailable or already linked."), 400
        asset.title_id = None
        asset.episode_id = ep.id
    if audio_mode:
        db.session.add(EpisodeMetadata(episode_id=ep.id, audio_mode=audio_mode))
    try:
        _update_episode_segments(ep, d)
    except ValueError as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 400
    db.session.commit()
    return jsonify(ep.to_dict()), 201


@bp.put("/episodes/<int:eid>")
@admin_required
def update_episode_segments(eid):
    episode = db.session.get(Episode, eid)
    if not episode:
        return jsonify(error="Episode not found."), 404
    try:
        _update_episode_segments(episode, request.get_json(silent=True) or {})
    except ValueError as exc:
        db.session.rollback()
        return jsonify(error=str(exc)), 400
    db.session.commit()
    return jsonify(episode.to_dict())


@bp.delete("/episodes/<int:eid>")
@admin_required
def delete_episode(eid):
    ep = db.session.get(Episode, eid)
    if not ep:
        return jsonify(error="Episode not found."), 404
    Progress.query.filter_by(episode_id=eid).update({"episode_id": None}, synchronize_session=False)
    WatchedEpisode.query.filter_by(episode_id=eid).delete(synchronize_session=False)
    PlaybackEvent.query.filter_by(episode_id=eid).delete(synchronize_session=False)
    ContentReport.query.filter_by(episode_id=eid).delete(synchronize_session=False)
    MediaAsset.query.filter_by(episode_id=eid).delete(synchronize_session=False)
    db.session.delete(ep)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/reports")
@admin_required
def list_reports():
    rows = (
        db.session.query(ContentReport, Title.title, User.email)
        .join(Title, Title.id == ContentReport.title_id)
        .join(User, User.id == ContentReport.user_id)
        .order_by(ContentReport.created_at.desc())
        .limit(200)
        .all()
    )
    return jsonify([
        {
            "id": report.id,
            "title_id": report.title_id,
            "title": title,
            "episode_id": report.episode_id,
            "category": report.category,
            "details": report.details,
            "status": report.status,
            "created_at": report.created_at.isoformat() if report.created_at else None,
            "email": email,
        }
        for report, title, email in rows
    ])


@bp.patch("/reports/<int:report_id>")
@admin_required
def update_report(report_id):
    report = db.session.get(ContentReport, report_id)
    if not report:
        return jsonify(error="Report not found."), 404
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in {"open", "resolved"}:
        return jsonify(error="status must be open or resolved."), 400
    report.status = status
    report.resolved_at = datetime.now(timezone.utc) if status == "resolved" else None
    db.session.commit()
    return jsonify(ok=True, status=report.status)


@bp.get("/analytics/playback")
@admin_required
def playback_analytics():
    rows = (
        db.session.query(
            Title.id,
            Title.title,
            func.sum(case((PlaybackEvent.event_type == "play", 1), else_=0)).label("plays"),
            func.sum(case((PlaybackEvent.event_type == "error", 1), else_=0)).label("errors"),
        )
        .outerjoin(PlaybackEvent, PlaybackEvent.title_id == Title.id)
        .group_by(Title.id, Title.title)
        .order_by(func.sum(case((PlaybackEvent.event_type == "play", 1), else_=0)).desc(), Title.id)
        .limit(100)
        .all()
    )
    return jsonify([
        {"title_id": title_id, "title": title, "plays": int(plays or 0), "errors": int(errors or 0)}
        for title_id, title, plays, errors in rows
    ])
