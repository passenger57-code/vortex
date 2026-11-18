import random
from flask import Blueprint, request, jsonify
from sqlalchemy import case, func, or_
from datetime import timezone
from extensions import db
from models import Episode, EpisodeMetadata, Genre, PlaybackEvent, Title, TitleMetadata, TitleStudio, now

bp = Blueprint("titles", __name__, url_prefix="/api")
TYPES = ("movie", "series", "anime")


def _filtered(type_=None, genre=None, q=None):
    visible = or_(
        ~Title.extra.has(),
        Title.extra.has(or_(TitleMetadata.publish_at.is_(None), TitleMetadata.publish_at <= now())),
    )
    query = Title.query.filter(visible)
    if type_ in TYPES:
        query = query.filter(Title.type == type_)
    if genre:
        query = query.filter(Title.genres.any(Genre.slug == genre))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Title.title.ilike(like), Title.description.ilike(like),
                                 Title.genres.any(Genre.name.ilike(like))))
    return query


def _most_watched(query, limit):
    plays = func.sum(case((PlaybackEvent.event_type == "play", 1), else_=0))
    return (
        query.outerjoin(PlaybackEvent, PlaybackEvent.title_id == Title.id)
        .group_by(Title.id)
        .order_by(plays.desc(), Title.popularity.desc(), Title.id)
        .limit(limit)
        .all()
    )


def _is_published(title):
    publish_at = title.extra.publish_at if title.extra else None
    if not publish_at:
        return True
    if publish_at.tzinfo is None:
        publish_at = publish_at.replace(tzinfo=timezone.utc)
    return publish_at <= now()


@bp.get("/titles")
def list_titles():
    limit = min(request.args.get("limit", 40, type=int), 100)
    offset = request.args.get("offset", 0, type=int)
    query = _filtered(request.args.get("type"), request.args.get("genre"), (request.args.get("q") or "").strip())
    items = query.order_by(Title.popularity.desc(), Title.id).offset(offset).limit(limit).all()
    return jsonify([t.to_dict() for t in items])


@bp.get("/titles/featured/carousel")
def featured_carousel():
    query = _filtered(request.args.get("type"))
    pool = query.filter(Title.featured.is_(True)).order_by(Title.popularity.desc(), Title.id).limit(5).all()
    if not pool:
        pool = query.order_by(Title.popularity.desc(), Title.id).limit(5).all()
    if not pool:
        return jsonify(error="No titles yet."), 404
    return jsonify([title.to_dict(detail=True) for title in pool])


@bp.get("/titles/featured")
def featured():
    """Random title for the billboard (like the random-movie endpoint in the tutorial)."""
    query = _filtered(request.args.get("type"))
    pool = query.filter(Title.featured.is_(True)).all() or query.all()
    if not pool:
        return jsonify(error="No titles yet."), 404
    return jsonify(random.choice(pool).to_dict(detail=True))


@bp.get("/titles/<int:title_id>")
def get_title(title_id):
    t = db.session.get(Title, title_id)
    if not t or not _is_published(t):
        return jsonify(error="Title not found."), 404
    return jsonify(t.to_dict(detail=True))


@bp.get("/genres")
def genres():
    rows = Genre.query.order_by(Genre.name).all()
    return jsonify([{"id": g.id, "name": g.name, "slug": g.slug} for g in rows])


@bp.get("/browse/facets")
def browse_facets():
    visible = _filtered()
    years = [
        year for (year,) in visible.with_entities(Title.year).filter(Title.year.isnot(None)).distinct()
        .order_by(Title.year.desc()).all()
    ]
    studios = (
        db.session.query(TitleStudio.slug, TitleStudio.name)
        .join(Title, Title.id == TitleStudio.title_id)
        .filter(visible.whereclause)
        .distinct()
        .order_by(TitleStudio.name)
        .all()
    )
    return jsonify({
        "genres": [{"id": genre.id, "name": genre.name, "slug": genre.slug}
                   for genre in Genre.query.order_by(Genre.name).all()],
        "years": years,
        "studios": [{"slug": slug, "name": name} for slug, name in studios],
        "audio_modes": ["sub", "dub"],
        "statuses": ["airing", "completed", "upcoming"],
    })


@bp.get("/browse/titles")
def browse_titles():
    type_ = request.args.get("type")
    if type_ and type_ not in TYPES:
        return jsonify(error="type must be movie, series, or anime."), 400
    query = _filtered(type_, request.args.get("genre"))
    year = request.args.get("year", type=int)
    if request.args.get("year") and year is None:
        return jsonify(error="year must be a valid year."), 400
    if year is not None:
        query = query.filter(Title.year == year)
    studio = request.args.get("studio")
    if studio:
        query = query.filter(Title.studios.any(TitleStudio.slug == studio))
    audio_mode = request.args.get("audio_mode")
    if audio_mode:
        if audio_mode not in {"sub", "dub"}:
            return jsonify(error="audio_mode must be sub or dub."), 400
        matching_modes = [audio_mode, "both"]
        query = query.filter(or_(
            Title.extra.has(TitleMetadata.audio_mode.in_(matching_modes)),
            Title.episodes.any(Episode.extra.has(EpisodeMetadata.audio_mode.in_(matching_modes))),
        ))
    status = request.args.get("status")
    if status:
        if status not in {"airing", "completed", "upcoming"}:
            return jsonify(error="status must be airing, completed, or upcoming."), 400
        query = query.filter(Title.extra.has(TitleMetadata.airing_status == status))
    sort = request.args.get("sort", "popular")
    sort_order = {
        "popular": (Title.popularity.desc(), Title.id.desc()),
        "newest": (Title.year.desc(), Title.id.desc()),
        "oldest": (Title.year.asc(), Title.id.asc()),
        "title-asc": (func.lower(Title.title).asc(), Title.id.asc()),
        "title-desc": (func.lower(Title.title).desc(), Title.id.desc()),
        "recently-added": (Title.created_at.desc(), Title.id.desc()),
    }.get(sort)
    if not sort_order:
        return jsonify(error="Choose a supported sort order."), 400
    limit = min(max(request.args.get("limit", 60, type=int), 1), 100)
    offset = max(request.args.get("offset", 0, type=int), 0)
    total = query.count()
    items = query.order_by(*sort_order).offset(offset).limit(limit).all()
    return jsonify({"items": [title.to_dict() for title in items], "total": total})


@bp.get("/browse")
def browse():
    """Rows for the home / category pages."""
    type_ = request.args.get("type")
    base = _filtered(type_)
    rows = []

    def add(key, label, items):
        if items:
            rows.append({"key": key, "label": label, "items": [t.to_dict() for t in items]})

    add("top-10", "Top 10", _most_watched(base, 10))
    add("trending", "Trending now" if not type_ else "Popular", base.order_by(Title.popularity.desc()).limit(20).all())
    if not type_:
        add("new", "New releases", base.order_by(Title.year.desc(), Title.id.desc()).limit(20).all())
        for t, label in (("series", "Series"), ("anime", "Anime"), ("movie", "Movies")):
            add(t, label, _filtered(t).order_by(Title.popularity.desc()).limit(20).all())
    for g in Genre.query.order_by(Genre.name).all():
        items = _filtered(type_, g.slug).order_by(Title.popularity.desc()).limit(20).all()
        if len(items) >= 3:
            add(f"genre-{g.slug}", g.name, items)
    franchises = (
        db.session.query(TitleMetadata.franchise_name)
        .join(Title, Title.id == TitleMetadata.title_id)
        .filter(TitleMetadata.franchise_name.isnot(None))
        .distinct()
        .all()
    )
    for (name,) in franchises:
        items = _filtered(type_).join(TitleMetadata, TitleMetadata.title_id == Title.id).filter(
            TitleMetadata.franchise_name == name
        ).order_by(Title.year, Title.id).limit(20).all()
        if items:
            add(f"franchise-{name}", name, items)
    return jsonify(rows)
