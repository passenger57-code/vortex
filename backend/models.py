from datetime import datetime, timezone
from urllib.parse import unquote, urlsplit
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db


def now():
    return datetime.now(timezone.utc)


def _asset_for_url(url, file_type):
    if not url:
        return None
    path = unquote(urlsplit(url).path).replace("\\", "/")
    if path.startswith("/media/"):
        relative = path[len("/media/"):]
        return next(
            (asset for asset in MediaAsset.query.filter_by(file_type=file_type, storage_provider="local").all()
             if asset.file_path.replace("\\", "/") == relative),
            None,
        )
    if "/storage/v1/object/" not in path:
        return None
    for asset in MediaAsset.query.filter_by(file_type=file_type).all():
        if path.endswith("/" + asset.file_path.replace("\\", "/")):
            return asset
    return None


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now)
    profiles = db.relationship("Profile", backref="user", cascade="all, delete-orphan", order_by="Profile.id")

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def to_dict(self):
        return {"id": self.id, "email": self.email, "is_admin": self.is_admin}


class AuthState(db.Model):
    __tablename__ = "auth_states"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    token_version = db.Column(db.Integer, nullable=False, default=0)


class AuthSession(db.Model):
    __tablename__ = "auth_sessions"
    id = db.Column(db.String(48), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    user_agent = db.Column(db.String(255), nullable=False, default="")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    last_seen_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    revoked_at = db.Column(db.DateTime(timezone=True))


class AccountSecurity(db.Model):
    __tablename__ = "account_security"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    email_verified = db.Column(db.Boolean, nullable=False, default=False)


class AccountToken(db.Model):
    __tablename__ = "account_tokens"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    purpose = db.Column(db.String(32), nullable=False, index=True)
    token_hash = db.Column(db.String(64), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    consumed_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), default=now)


class Profile(db.Model):
    __tablename__ = "profiles"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name = db.Column(db.String(40), nullable=False)
    color = db.Column(db.String(16), default="#1f8bff")
    created_at = db.Column(db.DateTime(timezone=True), default=now)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color}


title_genres = db.Table(
    "title_genres",
    db.Column("title_id", db.Integer, db.ForeignKey("titles.id"), primary_key=True),
    db.Column("genre_id", db.Integer, db.ForeignKey("genres.id"), primary_key=True),
)


class Genre(db.Model):
    __tablename__ = "genres"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(60), unique=True, nullable=False)
    slug = db.Column(db.String(60), unique=True, nullable=False)


class Title(db.Model):
    """A movie, a series or an anime. Series/anime have episodes."""
    __tablename__ = "titles"
    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(10), nullable=False, index=True)  # movie | series | anime
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    year = db.Column(db.Integer)
    maturity = db.Column(db.String(10), default="PG")
    duration = db.Column(db.Integer)  # minutes (movies)
    poster_url = db.Column(db.String(500))
    backdrop_url = db.Column(db.String(500))
    video_url = db.Column(db.String(500))  # movies only
    subtitle_url = db.Column(db.String(500))  # optional WebVTT file
    featured = db.Column(db.Boolean, default=False)
    popularity = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=now)
    genres = db.relationship("Genre", secondary=title_genres, lazy="joined")
    studios = db.relationship("TitleStudio", backref="title", cascade="all, delete-orphan", order_by="TitleStudio.name")
    episodes = db.relationship(
        "Episode", backref="title", cascade="all, delete-orphan",
        order_by="(Episode.season, Episode.number)",
    )

    def to_dict(self, detail=False):
        video_asset = next((asset for asset in self.media_assets if asset.file_type == "video"), None) or _asset_for_url(self.video_url, "video")
        subtitle_asset = next((asset for asset in self.media_assets if asset.file_type == "subtitle"), None) or _asset_for_url(self.subtitle_url, "subtitle")
        d = {
            "id": self.id, "type": self.type, "title": self.title,
            "description": self.description, "year": self.year,
            "maturity": self.maturity, "duration": self.duration,
            "poster_url": self.poster_url, "backdrop_url": self.backdrop_url,
            "video_url": None if video_asset else self.video_url,
            "subtitle_url": None if subtitle_asset else self.subtitle_url,
            "genres": [g.name for g in self.genres],
            "studios": [studio.name for studio in self.studios],
            "video_asset_id": video_asset.id if video_asset else None,
            "subtitle_asset_id": subtitle_asset.id if subtitle_asset else None,
            "airing_status": self.extra.airing_status if self.extra else None,
            "audio_mode": self.extra.audio_mode if self.extra else None,
            "publish_at": self.extra.publish_at.isoformat() if self.extra and self.extra.publish_at else None,
            "trailer_url": self.extra.trailer_url if self.extra else None,
            "franchise_name": self.extra.franchise_name if self.extra else None,
            "theme_color": self.extra.theme_color if self.extra else None,
            "cast": [name for name in (self.extra.cast_names or "").split(",") if name.strip()] if self.extra else [],
            "attribution": self.extra.attribution if self.extra else None,
        }
        if self.type != "movie":
            seasons = {e.season for e in self.episodes}
            d["seasons"] = len(seasons)
            d["episode_count"] = len(self.episodes)
        if detail:
            d["episodes"] = [e.to_dict() for e in self.episodes]
        return d


class Episode(db.Model):
    __tablename__ = "episodes"
    id = db.Column(db.Integer, primary_key=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    season = db.Column(db.Integer, default=1, nullable=False)
    number = db.Column(db.Integer, default=1, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default="")
    duration = db.Column(db.Integer)  # minutes
    video_url = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500))
    subtitle_url = db.Column(db.String(500))  # optional WebVTT file

    def to_dict(self):
        video_asset = next((asset for asset in self.media_assets if asset.file_type == "video"), None) or _asset_for_url(self.video_url, "video")
        subtitle_asset = next((asset for asset in self.media_assets if asset.file_type == "subtitle"), None) or _asset_for_url(self.subtitle_url, "subtitle")
        episode_extra = self.extra
        segments = self.segments
        return {
            "id": self.id, "title_id": self.title_id, "season": self.season,
            "number": self.number, "name": self.name, "description": self.description,
            "duration": self.duration,
            "video_url": None if video_asset else self.video_url,
            "thumbnail_url": self.thumbnail_url,
            "subtitle_url": None if subtitle_asset else self.subtitle_url,
            "video_asset_id": video_asset.id if video_asset else None,
            "subtitle_asset_id": subtitle_asset.id if subtitle_asset else None,
            "created_at": episode_extra.created_at.isoformat() if episode_extra and episode_extra.created_at else None,
            "audio_mode": episode_extra.audio_mode if episode_extra else None,
            "intro_start": segments.intro_start if segments else None,
            "intro_end": segments.intro_end if segments else None,
            "recap_start": segments.recap_start if segments else None,
            "recap_end": segments.recap_end if segments else None,
            "credits_start": segments.credits_start if segments else None,
            "is_new": bool(episode_extra and episode_extra.created_at and
                           (now() - episode_extra.created_at.replace(tzinfo=timezone.utc) if episode_extra.created_at.tzinfo is None else now() - episode_extra.created_at).days <= 14),
        }


class TitleMetadata(db.Model):
    __tablename__ = "title_metadata"
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), primary_key=True)
    airing_status = db.Column(db.String(20), nullable=False, default="completed")
    audio_mode = db.Column(db.String(12), nullable=False, default="sub")
    publish_at = db.Column(db.DateTime(timezone=True))
    trailer_url = db.Column(db.String(500))
    franchise_name = db.Column(db.String(120), index=True)
    theme_color = db.Column(db.String(16))
    attribution = db.Column(db.String(120))
    cast_names = db.Column(db.Text)


class TitleStudio(db.Model):
    __tablename__ = "title_studios"
    id = db.Column(db.Integer, primary_key=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    slug = db.Column(db.String(120), nullable=False, index=True)
    __table_args__ = (db.UniqueConstraint("title_id", "slug"),)


class EpisodeMetadata(db.Model):
    __tablename__ = "episode_metadata"
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"), primary_key=True)
    created_at = db.Column(db.DateTime(timezone=True), default=now, nullable=False)
    audio_mode = db.Column(db.String(12))


class EpisodeSegments(db.Model):
    __tablename__ = "episode_segments"
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"), primary_key=True)
    intro_start = db.Column(db.Float)
    intro_end = db.Column(db.Float)
    recap_start = db.Column(db.Float)
    recap_end = db.Column(db.Float)
    credits_start = db.Column(db.Float)


class ProfileVisit(db.Model):
    __tablename__ = "profile_visits"
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), primary_key=True)
    last_seen_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)


class Favorite(db.Model):
    __tablename__ = "favorites"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=now)
    __table_args__ = (db.UniqueConstraint("profile_id", "title_id"),)


class Progress(db.Model):
    """Viewing history: one row per profile + title, pointing at the latest episode."""
    __tablename__ = "progress"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"))
    position = db.Column(db.Float, default=0)
    duration = db.Column(db.Float, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (db.UniqueConstraint("profile_id", "title_id"),)

    def to_dict(self):
        return {
            "title_id": self.title_id, "episode_id": self.episode_id,
            "position": self.position, "duration": self.duration,
        }


class EpisodeProgress(db.Model):
    __tablename__ = "episode_progress"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"), nullable=False, index=True)
    position = db.Column(db.Float, default=0)
    duration = db.Column(db.Float, default=0)
    updated_at = db.Column(db.DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (db.UniqueConstraint("profile_id", "episode_id"),)


class WatchedEpisode(db.Model):
    __tablename__ = "watched_episodes"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"), nullable=False, index=True)
    watched_at = db.Column(db.DateTime(timezone=True), default=now)
    __table_args__ = (db.UniqueConstraint("profile_id", "episode_id"),)


class TitleRating(db.Model):
    __tablename__ = "title_ratings"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    rating = db.Column(db.SmallInteger, nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=now, onupdate=now)
    __table_args__ = (db.UniqueConstraint("profile_id", "title_id"),)


class ContentReport(db.Model):
    __tablename__ = "content_reports"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"))
    category = db.Column(db.String(40), nullable=False)
    details = db.Column(db.String(1000), default="")
    status = db.Column(db.String(20), nullable=False, default="open", index=True)
    created_at = db.Column(db.DateTime(timezone=True), default=now)
    resolved_at = db.Column(db.DateTime(timezone=True))


class PlaybackEvent(db.Model):
    __tablename__ = "playback_events"
    id = db.Column(db.Integer, primary_key=True)
    profile_id = db.Column(db.Integer, db.ForeignKey("profiles.id"), nullable=False, index=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), nullable=False, index=True)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"))
    event_type = db.Column(db.String(20), nullable=False, index=True)
    error_code = db.Column(db.String(100))
    details = db.Column(db.String(500))
    created_at = db.Column(db.DateTime(timezone=True), default=now, index=True)


class MediaAsset(db.Model):
    __tablename__ = "media_assets"
    id = db.Column(db.Integer, primary_key=True)
    title_id = db.Column(db.Integer, db.ForeignKey("titles.id"), index=True, nullable=True)
    episode_id = db.Column(db.Integer, db.ForeignKey("episodes.id"), index=True, nullable=True)
    storage_provider = db.Column(db.String(20), nullable=False, default="local")
    bucket_name = db.Column(db.String(200), nullable=True)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(40), nullable=False, default="video")
    file_size = db.Column(db.Integer, nullable=False, default=0)
    processing_status = db.Column(db.String(30), nullable=False, default="ready")
    created_at = db.Column(db.DateTime(timezone=True), default=now)

    title = db.relationship("Title", backref="media_assets")
    episode = db.relationship("Episode", backref="media_assets")

    def to_dict(self):
        return {
            "id": self.id,
            "title_id": self.title_id,
            "episode_id": self.episode_id,
            "storage_provider": self.storage_provider,
            "bucket_name": self.bucket_name,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "processing_status": self.processing_status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


Title.extra = db.relationship(
    "TitleMetadata", backref="title", uselist=False, cascade="all, delete-orphan"
)
Episode.extra = db.relationship(
    "EpisodeMetadata", backref="episode", uselist=False, cascade="all, delete-orphan"
)
Episode.segments = db.relationship(
    "EpisodeSegments", backref="episode", uselist=False, cascade="all, delete-orphan"
)
