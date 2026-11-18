from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt, get_jwt_identity
from extensions import db
from models import User, Profile


def current_user():
    return db.session.get(User, int(get_jwt_identity()))


def current_profile(user):
    """Profile picked by the X-Profile-Id header (must belong to the user), else the first one."""
    pid = request.headers.get("X-Profile-Id", type=int)
    if pid:
        p = db.session.get(Profile, pid)
        if p and p.user_id == user.id:
            return p
    return user.profiles[0] if user.profiles else None


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if not get_jwt().get("admin"):
            return jsonify(error="Admin access required."), 403
        return fn(*args, **kwargs)
    return wrapper
