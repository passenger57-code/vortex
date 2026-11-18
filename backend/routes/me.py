from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_
from extensions import db
from models import (
    ContentReport, Episode, EpisodeMetadata, EpisodeProgress, Favorite, PlaybackEvent,
    Profile, ProfileVisit, Progress, Title, TitleRating, TitleMetadata, WatchedEpisode, now,
)
from routes.helpers import current_user, current_profile
from routes.auth import COLORS

bp = Blueprint("me", __name__, url_prefix="/api/me")
MAX_PROFILES = 5


@bp.get("/profiles")
@jwt_required()
def list_profiles():
    return jsonify([p.to_dict() for p in current_user().profiles])


@bp.post("/profiles")
@jwt_required()
def create_profile():
    user = current_user()
    name = ((request.get_json(silent=True) or {}).get("name") or "").strip()
    if not name:
        return jsonify(error="Give the profile a name."), 400
    if len(user.profiles) >= MAX_PROFILES:
        return jsonify(error=f"You can have up to {MAX_PROFILES} profiles."), 400
    p = Profile(user_id=user.id, name=name[:40], color=COLORS[len(user.profiles) % len(COLORS)])
    db.session.add(p)
    db.session.commit()
    return jsonify(p.to_dict()), 201


@bp.delete("/profiles/<int:pid>")
@jwt_required()
def delete_profile(pid):
    user = current_user()
    p = db.session.get(Profile, pid)
    if not p or p.user_id != user.id:
        return jsonify(error="Profile not found."), 404
    if len(user.profiles) <= 1:
        return jsonify(error="You need at least one profile."), 400
    Favorite.query.filter_by(profile_id=pid).delete()
    Progress.query.filter_by(profile_id=pid).delete()
    EpisodeProgress.query.filter_by(profile_id=pid).delete()
    TitleRating.query.filter_by(profile_id=pid).delete()
    WatchedEpisode.query.filter_by(profile_id=pid).delete()
    PlaybackEvent.query.filter_by(profile_id=pid).delete()
    ContentReport.query.filter_by(profile_id=pid).delete()
    db.session.query(ProfileVisit).filter_by(profile_id=pid).delete(synchronize_session=False)
    db.session.delete(p)
    db.session.commit()
    return jsonify(ok=True)


# ---- My List -------------------------------------------------------------
@bp.get("/list")
@jwt_required()
def my_list():
    prof = current_profile(current_user())
    favs = (Favorite.query.filter_by(profile_id=prof.id).order_by(Favorite.created_at.desc()).all())
    ids = [f.title_id for f in favs]
    titles = {t.id: t for t in Title.query.filter(Title.id.in_(ids)).all()} if ids else {}
    return jsonify([titles[i].to_dict() for i in ids if i in titles])


@bp.post("/list/<int:title_id>")
@jwt_required()
def add_to_list(title_id):
    prof = current_profile(current_user())
    if not db.session.get(Title, title_id):
        return jsonify(error="Title not found."), 404
    if not Favorite.query.filter_by(profile_id=prof.id, title_id=title_id).first():
        db.session.add(Favorite(profile_id=prof.id, title_id=title_id))
        db.session.commit()
    return jsonify(ok=True, in_list=True), 201


@bp.delete("/list/<int:title_id>")
@jwt_required()
def remove_from_list(title_id):
    prof = current_profile(current_user())
    Favorite.query.filter_by(profile_id=prof.id, title_id=title_id).delete()
    db.session.commit()
    return jsonify(ok=True, in_list=False)


@bp.get("/list/ids")
@jwt_required()
def list_ids():
    prof = current_profile(current_user())
    return jsonify([f.title_id for f in Favorite.query.filter_by(profile_id=prof.id).all()])


# ---- Viewing progress ----------------------------------------------------
def _progress_payload(profile, *, limit=None, include_completed=False):
    rows = Progress.query.filter_by(profile_id=profile.id).order_by(Progress.updated_at.desc())
    if limit is not None:
        rows = rows.limit(limit)
    out = []
    for r in rows.all():
        t = db.session.get(Title, r.title_id)
        if not t:
            continue
        pct = (r.position / r.duration) if r.duration else 0
        if not include_completed and t.type == "movie" and pct >= 0.95:
            continue
        d = t.to_dict()
        d["progress"] = {**r.to_dict(), "percent": round(min(pct, 1), 3)}
        if r.episode_id:
            ep = db.session.get(Episode, r.episode_id)
            if ep:
                d["progress"]["episode"] = {"season": ep.season, "number": ep.number, "name": ep.name}
        out.append(d)
    return out


@bp.get("/progress")
@jwt_required()
def list_progress():
    prof = current_profile(current_user())
    return jsonify(_progress_payload(prof, include_completed=True))


@bp.put("/progress")
@jwt_required()
def save_progress():
    prof = current_profile(current_user())
    d = request.get_json(silent=True) or {}
    title = db.session.get(Title, d.get("title_id") or 0)
    if not title:
        return jsonify(error="Title not found."), 404
    episode_id = d.get("episode_id")
    if episode_id and not Episode.query.filter_by(id=episode_id, title_id=title.id).first():
        return jsonify(error="Episode not found."), 404
    row = Progress.query.filter_by(profile_id=prof.id, title_id=title.id).first()
    if not row:
        row = Progress(profile_id=prof.id, title_id=title.id)
        db.session.add(row)
    row.episode_id = episode_id
    row.position = float(d.get("position") or 0)
    row.duration = float(d.get("duration") or 0)
    if episode_id:
        episode_row = EpisodeProgress.query.filter_by(profile_id=prof.id, episode_id=episode_id).first()
        if not episode_row:
            episode_row = EpisodeProgress(
                profile_id=prof.id, title_id=title.id, episode_id=episode_id,
            )
            db.session.add(episode_row)
        episode_row.position = row.position
        episode_row.duration = row.duration
    if episode_id and row.duration > 0 and row.position / row.duration >= 0.95:
        watched = WatchedEpisode.query.filter_by(profile_id=prof.id, episode_id=episode_id).first()
        if not watched:
            db.session.add(WatchedEpisode(profile_id=prof.id, title_id=title.id, episode_id=episode_id))
    db.session.commit()
    return jsonify(row.to_dict())


@bp.get("/progress/<int:title_id>")
@jwt_required()
def get_progress(title_id):
    prof = current_profile(current_user())
    row = Progress.query.filter_by(profile_id=prof.id, title_id=title_id).first()
    return jsonify(row.to_dict() if row else None)


@bp.get("/titles/<int:title_id>/episode-progress")
@jwt_required()
def list_episode_progress(title_id):
    prof = current_profile(current_user())
    if not db.session.get(Title, title_id):
        return jsonify(error="Title not found."), 404
    rows = EpisodeProgress.query.filter_by(profile_id=prof.id, title_id=title_id).all()
    return jsonify({
        row.episode_id: {
            "position": row.position,
            "duration": row.duration,
        }
        for row in rows
    })


@bp.delete("/progress/<int:title_id>")
@jwt_required()
def delete_progress(title_id):
    prof = current_profile(current_user())
    row = Progress.query.filter_by(profile_id=prof.id, title_id=title_id).first()
    if not row:
        return jsonify(error="Progress not found."), 404
    db.session.delete(row)
    EpisodeProgress.query.filter_by(profile_id=prof.id, title_id=title_id).delete()
    db.session.commit()
    return jsonify(ok=True)


@bp.delete("/progress")
@jwt_required()
def clear_progress():
    prof = current_profile(current_user())
    Progress.query.filter_by(profile_id=prof.id).delete()
    EpisodeProgress.query.filter_by(profile_id=prof.id).delete()
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/continue")
@jwt_required()
def continue_watching():
    prof = current_profile(current_user())
    return jsonify(_progress_payload(prof, limit=20))


@bp.get("/notifications/new-episodes")
@jwt_required()
def new_episode_notifications():
    profile = current_profile(current_user())
    timestamp = now()
    visit = db.session.get(ProfileVisit, profile.id)
    if not visit:
        db.session.add(ProfileVisit(profile_id=profile.id, last_seen_at=timestamp))
        db.session.commit()
        return jsonify(count=0, titles=[])

    rows = (
        db.session.query(Title.id, Title.title, func.count(Episode.id))
        .join(Episode, Episode.title_id == Title.id)
        .join(EpisodeMetadata, EpisodeMetadata.episode_id == Episode.id)
        .outerjoin(TitleMetadata, TitleMetadata.title_id == Title.id)
        .filter(
            EpisodeMetadata.created_at > visit.last_seen_at,
            or_(TitleMetadata.publish_at.is_(None), TitleMetadata.publish_at <= timestamp),
        )
        .group_by(Title.id, Title.title)
        .all()
    )
    visit.last_seen_at = timestamp
    db.session.commit()
    return jsonify(
        count=sum(count for _, _, count in rows),
        titles=[{"id": title_id, "title": title, "new_episodes": count} for title_id, title, count in rows],
    )


@bp.get("/watched-episodes")
@jwt_required()
def watched_episodes():
    prof = current_profile(current_user())
    return jsonify([row.episode_id for row in WatchedEpisode.query.filter_by(profile_id=prof.id).all()])


@bp.post("/titles/<int:title_id>/watched-episodes")
@jwt_required()
def mark_title_episodes_watched(title_id):
    profile = current_profile(current_user())
    title = db.session.get(Title, title_id)
    if not title or title.type == "movie":
        return jsonify(error="Series or anime title not found."), 404
    episodes = Episode.query.filter_by(title_id=title.id).all()
    existing = {
        row.episode_id
        for row in WatchedEpisode.query.filter_by(profile_id=profile.id, title_id=title.id).all()
    }
    db.session.add_all([
        WatchedEpisode(profile_id=profile.id, title_id=title.id, episode_id=episode.id)
        for episode in episodes if episode.id not in existing
    ])
    db.session.commit()
    return jsonify(episode_ids=[episode.id for episode in episodes], watched_count=len(episodes))


@bp.get("/ratings/<int:title_id>")
@jwt_required()
def get_rating(title_id):
    profile = current_profile(current_user())
    row = TitleRating.query.filter_by(profile_id=profile.id, title_id=title_id).first()
    return jsonify(rating=row.rating if row else 0)


@bp.put("/ratings/<int:title_id>")
@jwt_required()
def set_rating(title_id):
    profile = current_profile(current_user())
    if not db.session.get(Title, title_id):
        return jsonify(error="Title not found."), 404
    data = request.get_json(silent=True) or {}
    try:
        rating = int(data.get("rating"))
    except (TypeError, ValueError):
        return jsonify(error="Rating must be 1, -1, or 0."), 400
    if rating not in (-1, 0, 1):
        return jsonify(error="Rating must be 1, -1, or 0."), 400
    row = TitleRating.query.filter_by(profile_id=profile.id, title_id=title_id).first()
    if rating == 0:
        if row:
            db.session.delete(row)
    elif row:
        row.rating = rating
    else:
        db.session.add(TitleRating(profile_id=profile.id, title_id=title_id, rating=rating))
    db.session.commit()
    return jsonify(rating=rating)


@bp.get("/recommendations/<int:title_id>")
@jwt_required()
def recommendations(title_id):
    anchor = db.session.get(Title, title_id)
    if not anchor:
        return jsonify(error="Title not found."), 404
    genre_ids = {genre.id for genre in anchor.genres}
    if not genre_ids:
        return jsonify([])
    ratings = {
        row.title_id: row.rating
        for row in TitleRating.query.filter_by(profile_id=current_profile(current_user()).id).all()
    }
    candidates = Title.query.filter(Title.id != anchor.id, Title.genres.any()).all()
    ranked = []
    for candidate in candidates:
        overlap = len(genre_ids.intersection(genre.id for genre in candidate.genres))
        if overlap:
            ranked.append((overlap * 2 + ratings.get(candidate.id, 0), candidate.popularity or 0, candidate))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return jsonify([candidate.to_dict() for _, _, candidate in ranked[:10]])


@bp.post("/reports")
@jwt_required()
def create_report():
    profile = current_profile(current_user())
    data = request.get_json(silent=True) or {}
    title = db.session.get(Title, data.get("title_id") or 0)
    if not title:
        return jsonify(error="Title not found."), 404
    episode_id = data.get("episode_id")
    if episode_id and not Episode.query.filter_by(id=episode_id, title_id=title.id).first():
        return jsonify(error="Episode not found."), 404
    category = (data.get("category") or "").strip().lower()
    allowed = {"broken_video", "wrong_subtitles", "audio", "other"}
    if category not in allowed:
        return jsonify(error="Choose a valid problem type."), 400
    report = ContentReport(
        user_id=current_user().id,
        profile_id=profile.id,
        title_id=title.id,
        episode_id=episode_id,
        category=category,
        details=(data.get("details") or "").strip()[:1000],
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(id=report.id, status=report.status), 201


@bp.post("/playback-events")
@jwt_required()
def log_playback_event():
    profile = current_profile(current_user())
    data = request.get_json(silent=True) or {}
    title = db.session.get(Title, data.get("title_id") or 0)
    if not title:
        return jsonify(error="Title not found."), 404
    episode_id = data.get("episode_id")
    if episode_id and not Episode.query.filter_by(id=episode_id, title_id=title.id).first():
        return jsonify(error="Episode not found."), 404
    event_type = data.get("event_type")
    if event_type not in {"play", "error"}:
        return jsonify(error="event_type must be play or error."), 400
    db.session.add(PlaybackEvent(
        profile_id=profile.id,
        title_id=title.id,
        episode_id=episode_id,
        event_type=event_type,
        error_code=(data.get("error_code") or "")[:100],
        details=(data.get("details") or "")[:500],
    ))
    db.session.commit()
    return jsonify(ok=True), 201
