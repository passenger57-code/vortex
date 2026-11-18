import hashlib
import re
import secrets
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, request, jsonify
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required
from extensions import db, limiter
from models import (
    AccountSecurity, AccountToken, AuthSession, AuthState, ContentReport, Favorite, PlaybackEvent,
    ProfileVisit, Progress, Profile, TitleRating, User, WatchedEpisode,
)
from routes.helpers import current_user
from services.account_email import email_is_configured, send_account_link

bp = Blueprint("auth", __name__, url_prefix="/api/auth")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
COLORS = ["#1f8bff", "#38d0ff", "#7a5cff", "#16c79a", "#ff6b81", "#ffb020"]
GENERIC_EMAIL_RESPONSE = {"message": "If the account is eligible, an email with next steps will arrive shortly."}


def _session(user):
    state = db.session.get(AuthState, user.id)
    if not state:
        state = AuthState(user_id=user.id, token_version=0)
        db.session.add(state)
    session_id = secrets.token_urlsafe(24)
    auth_session = AuthSession(
        id=session_id,
        user_id=user.id,
        user_agent=request.user_agent.string[:255],
    )
    db.session.add(auth_session)
    db.session.commit()
    security = db.session.get(AccountSecurity, user.id)
    claims = {"admin": user.is_admin, "sv": state.token_version, "sid": session_id}
    token = create_access_token(identity=str(user.id), additional_claims=claims)
    return {
        "token": token,
        "user": {**user.to_dict(), "email_verified": security.email_verified if security else True},
        "profiles": [p.to_dict() for p in user.profiles],
    }


def _revoke_active_sessions(user_id):
    AuthSession.query.filter_by(user_id=user_id, revoked_at=None).update(
        {"revoked_at": datetime.now(timezone.utc)},
        synchronize_session=False,
    )


def _issue_account_token(user, purpose, lifetime):
    AccountToken.query.filter_by(user_id=user.id, purpose=purpose, consumed_at=None).delete()
    raw_token = secrets.token_urlsafe(32)
    row = AccountToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        expires_at=datetime.now(timezone.utc) + lifetime,
    )
    db.session.add(row)
    db.session.commit()
    try:
        send_account_link(user, raw_token, purpose)
    except Exception:
        db.session.rollback()
        current_app.logger.exception("Unable to deliver %s email for user %s", purpose, user.id)
        raise


def _valid_account_token(raw_token, purpose):
    if not isinstance(raw_token, str) or not raw_token:
        return None
    digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    row = AccountToken.query.filter_by(token_hash=digest, purpose=purpose, consumed_at=None).first()
    if not row:
        return None
    expires_at = row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None
    return row


@bp.post("/register")
@limiter.limit("10/minute")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip() or email.split("@")[0]
    if not EMAIL_RE.match(email):
        return jsonify(error="Enter a valid email address."), 400
    if len(password) < 6:
        return jsonify(error="Password must be at least 6 characters."), 400
    requires_verification = current_app.config.get("REQUIRE_EMAIL_VERIFICATION", False)
    if requires_verification and not email_is_configured():
        return jsonify(error="Email verification is enabled, but SMTP is not configured."), 503
    if User.query.filter_by(email=email).first():
        return jsonify(error="An account with this email already exists."), 409
    user = User(email=email)
    user.set_password(password)
    user.profiles.append(Profile(name=name[:40], color=COLORS[0]))
    db.session.add(user)
    db.session.commit()
    db.session.add(AccountSecurity(user_id=user.id, email_verified=not requires_verification))
    db.session.add(AuthState(user_id=user.id, token_version=0))
    db.session.commit()
    if requires_verification:
        try:
            _issue_account_token(user, "verify_email", timedelta(hours=24))
        except Exception:
            return jsonify(error="Your account was created, but the verification email could not be sent. Please request another email."), 503
        return jsonify(verification_required=True, email=user.email), 201
    return jsonify(_session(user)), 201


@bp.post("/login")
@limiter.limit("10/minute")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(data.get("password") or ""):
        return jsonify(error="Incorrect email or password."), 401
    security = db.session.get(AccountSecurity, user.id)
    if current_app.config.get("REQUIRE_EMAIL_VERIFICATION") and security and not security.email_verified:
        return jsonify(error="Verify your email before signing in. You can request a new verification email."), 403
    return jsonify(_session(user))


@bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if not user:
        return jsonify(error="Account not found."), 404
    claims = get_jwt()
    session_id = claims.get("sid")
    auth_session = db.session.get(AuthSession, session_id) if session_id else None
    if auth_session and auth_session.user_id == user.id and not auth_session.revoked_at:
        auth_session.last_seen_at = datetime.now(timezone.utc)
        db.session.commit()
    security = db.session.get(AccountSecurity, user.id)
    return jsonify({
        "user": {**user.to_dict(), "email_verified": security.email_verified if security else True},
        "profiles": [profile.to_dict() for profile in user.profiles],
    })


@bp.post("/verification/resend")
@limiter.limit("5/hour")
def resend_verification():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email_is_configured():
        return jsonify(error="Email delivery is not configured. Contact the administrator."), 503
    user = User.query.filter_by(email=email).first() if EMAIL_RE.match(email) else None
    security = db.session.get(AccountSecurity, user.id) if user else None
    try:
        if user and (not security or not security.email_verified):
            _issue_account_token(user, "verify_email", timedelta(hours=24))
    except Exception:
        return jsonify(error="The email could not be sent. Please try again later."), 503
    return jsonify(GENERIC_EMAIL_RESPONSE), 202


@bp.post("/verification/confirm")
@limiter.limit("10/minute")
def confirm_verification():
    data = request.get_json(silent=True) or {}
    token = _valid_account_token(data.get("token"), "verify_email")
    if not token:
        return jsonify(error="This verification link is invalid or expired. Request a new one."), 400
    security = db.session.get(AccountSecurity, token.user_id)
    if not security:
        security = AccountSecurity(user_id=token.user_id, email_verified=True)
        db.session.add(security)
    else:
        security.email_verified = True
    token.consumed_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(ok=True, message="Email verified. You can now sign in.")


@bp.post("/password/forgot")
@limiter.limit("5/hour")
def forgot_password():
    if not email_is_configured():
        return jsonify(error="Email delivery is not configured. Contact the administrator."), 503
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    user = User.query.filter_by(email=email).first() if EMAIL_RE.match(email) else None
    try:
        if user:
            _issue_account_token(user, "password_reset", timedelta(minutes=30))
    except Exception:
        return jsonify(error="The email could not be sent. Please try again later."), 503
    return jsonify(GENERIC_EMAIL_RESPONSE), 202


@bp.post("/password/reset")
@limiter.limit("10/minute")
def reset_password():
    data = request.get_json(silent=True) or {}
    password = data.get("password") or ""
    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters."), 400
    token = _valid_account_token(data.get("token"), "password_reset")
    if not token:
        return jsonify(error="This password reset link is invalid or expired. Request a new one."), 400
    user = db.session.get(User, token.user_id)
    if not user:
        return jsonify(error="This password reset link is invalid or expired. Request a new one."), 400
    user.set_password(password)
    token.consumed_at = datetime.now(timezone.utc)
    state = db.session.get(AuthState, user.id) or AuthState(user_id=user.id, token_version=0)
    state.token_version += 1
    db.session.add(state)
    _revoke_active_sessions(user.id)
    db.session.add(state)
    AccountToken.query.filter_by(user_id=user.id, purpose="password_reset", consumed_at=None).update(
        {"consumed_at": datetime.now(timezone.utc)}
    )
    db.session.commit()
    return jsonify(ok=True, message="Password updated. Sign in with your new password.")


@bp.post("/password/change")
@jwt_required()
def change_password():
    user = current_user()
    data = request.get_json(silent=True) or {}
    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    if not user or not user.check_password(current_password):
        return jsonify(error="Your current password is incorrect."), 400
    if len(new_password) < 8:
        return jsonify(error="New password must be at least 8 characters."), 400
    user.set_password(new_password)
    state = db.session.get(AuthState, user.id) or AuthState(user_id=user.id, token_version=0)
    state.token_version += 1
    db.session.add(state)
    _revoke_active_sessions(user.id)
    db.session.add(state)
    db.session.commit()
    return jsonify(ok=True, message="Password changed. Sign in again on your devices.")


@bp.post("/sessions/revoke")
@jwt_required()
def revoke_sessions():
    user_id = int(get_jwt_identity())
    state = db.session.get(AuthState, user_id) or AuthState(user_id=user_id, token_version=0)
    state.token_version += 1
    _revoke_active_sessions(user_id)
    db.session.add(state)
    db.session.commit()
    return jsonify(ok=True)


@bp.get("/sessions")
@jwt_required()
def list_sessions():
    user_id = int(get_jwt_identity())
    current_session_id = get_jwt().get("sid")
    current_session = db.session.get(AuthSession, current_session_id) if current_session_id else None
    if current_session and current_session.user_id == user_id and not current_session.revoked_at:
        current_session.last_seen_at = datetime.now(timezone.utc)
        db.session.commit()
    sessions = AuthSession.query.filter_by(user_id=user_id, revoked_at=None).order_by(
        AuthSession.last_seen_at.desc(),
    ).all()
    return jsonify([{
        "id": session.id,
        "current": session.id == current_session_id,
        "user_agent": session.user_agent,
        "created_at": session.created_at.isoformat(),
        "last_seen_at": session.last_seen_at.isoformat(),
    } for session in sessions])


@bp.delete("/sessions/<session_id>")
@jwt_required()
def revoke_session(session_id):
    user_id = int(get_jwt_identity())
    session = db.session.get(AuthSession, session_id)
    if not session or session.user_id != user_id or session.revoked_at:
        return jsonify(error="Session not found."), 404
    session.revoked_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(ok=True, current=session.id == get_jwt().get("sid"))


@bp.delete("/me")
@jwt_required()
def delete_account():
    user = current_user()
    data = request.get_json(silent=True) or {}
    if not user or not user.check_password(data.get("password") or ""):
        return jsonify(error="Your password is incorrect."), 400
    profile_ids = [profile.id for profile in user.profiles]
    if profile_ids:
        Favorite.query.filter(Favorite.profile_id.in_(profile_ids)).delete(synchronize_session=False)
        Progress.query.filter(Progress.profile_id.in_(profile_ids)).delete(synchronize_session=False)
        TitleRating.query.filter(TitleRating.profile_id.in_(profile_ids)).delete(synchronize_session=False)
        WatchedEpisode.query.filter(WatchedEpisode.profile_id.in_(profile_ids)).delete(synchronize_session=False)
        PlaybackEvent.query.filter(PlaybackEvent.profile_id.in_(profile_ids)).delete(synchronize_session=False)
        ProfileVisit.query.filter(ProfileVisit.profile_id.in_(profile_ids)).delete(synchronize_session=False)
    ContentReport.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    AuthSession.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    AccountToken.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.query(AccountSecurity).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.query(AuthState).filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.delete(user)
    db.session.commit()
    return jsonify(ok=True)
