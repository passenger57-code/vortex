from datetime import datetime, timedelta, timezone
import pytest

from app import app
from extensions import db, limiter
from models import AccountSecurity, Episode, EpisodeProgress, Favorite, Genre, Progress, Title, User, WatchedEpisode
import seed as seed_module


@pytest.fixture
def client():
    previous_limiter_state = limiter.enabled
    limiter.enabled = False
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite://",
        RATELIMIT_ENABLED=False,
        REQUIRE_EMAIL_VERIFICATION=False,
        SMTP_HOST="",
        SMTP_FROM="",
    )
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()
        limiter.enabled = previous_limiter_state


def test_register_login_and_admin_required(client):
    reg = client.post("/api/auth/register", json={"email": "user@example.com", "password": "secret123", "name": "User"})
    assert reg.status_code == 201, reg.get_data(as_text=True)
    payload = reg.get_json()
    token = payload["token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200

    admin = User(email="admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()

    admin_login = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "adminpass"})
    assert admin_login.status_code == 200, admin_login.get_data(as_text=True)
    admin_token = admin_login.get_json()["token"]

    forbidden = client.post("/api/admin/titles", headers={"Authorization": f"Bearer {token}"}, json={"type": "movie", "title": "Nope", "video_url": "https://example.com/a.mp4"})
    assert forbidden.status_code == 403

    created = client.post("/api/admin/titles", headers={"Authorization": f"Bearer {admin_token}"}, json={"type": "movie", "title": "Test Movie", "description": "Demo", "year": 2025, "maturity": "PG", "duration": 90, "poster_url": "https://example.com/poster.jpg", "backdrop_url": "https://example.com/backdrop.jpg", "video_url": "https://example.com/movie.mp4", "genres": ["Action"], "featured": True, "popularity": 80})
    assert created.status_code == 201, created.get_data(as_text=True)

    page = client.get("/api/titles")
    assert page.status_code == 200
    items = page.get_json()
    assert any(item["title"] == "Test Movie" for item in items)


def test_seed_syncs_admin_credentials_without_replacing_catalog(client, monkeypatch):
    monkeypatch.setattr(seed_module, "ADMIN_EMAIL", "admin@example.com")
    monkeypatch.setattr(seed_module, "ADMIN_PASSWORD", "new-admin-pass")
    admin = User(email="admin@example.com", is_admin=False)
    admin.set_password("old-admin-pass")
    title = Title(type="movie", title="Existing", video_url="https://example.com/a.mp4")
    db.session.add_all([admin, title])
    db.session.commit()

    seed_module.seed()

    assert Title.query.count() == 1
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "new-admin-pass"},
    )
    assert response.status_code == 200
    assert User.query.filter_by(email="admin@example.com").one().is_admin


def test_profile_and_progress_headers_do_not_cross_user_bounds(client):
    alice = client.post("/api/auth/register", json={"email": "alice@example.com", "password": "secret123", "name": "Alice"})
    bob = client.post("/api/auth/register", json={"email": "bob@example.com", "password": "secret123", "name": "Bob"})
    assert alice.status_code == 201, alice.get_data(as_text=True)
    assert bob.status_code == 201, bob.get_data(as_text=True)

    alice_token = alice.get_json()["token"]
    alice_profile_id = alice.get_json()["profiles"][0]["id"]
    bob_profile_id = bob.get_json()["profiles"][0]["id"]

    title = Title(type="movie", title="Sandbox", description="Demo", year=2025, maturity="PG", duration=90, video_url="https://example.com/a.mp4")
    db.session.add(title)
    db.session.commit()

    add_favorite = client.post(
        f"/api/me/list/{title.id}",
        headers={"Authorization": f"Bearer {alice_token}", "X-Profile-Id": str(bob_profile_id)},
    )
    assert add_favorite.status_code == 201
    assert Favorite.query.filter_by(profile_id=bob_profile_id, title_id=title.id).count() == 0
    assert Favorite.query.filter_by(profile_id=alice_profile_id, title_id=title.id).count() == 1

    save_progress = client.put(
        "/api/me/progress",
        headers={"Authorization": f"Bearer {alice_token}", "X-Profile-Id": str(bob_profile_id)},
        json={"title_id": title.id, "position": 25, "duration": 90},
    )
    assert save_progress.status_code == 200
    assert Progress.query.filter_by(profile_id=bob_profile_id, title_id=title.id).count() == 0
    assert Progress.query.filter_by(profile_id=alice_profile_id, title_id=title.id).count() == 1

    history = client.get("/api/me/progress", headers={"Authorization": f"Bearer {alice_token}", "X-Profile-Id": str(alice_profile_id)})
    assert history.status_code == 200
    history_payload = history.get_json()
    assert any(item["id"] == title.id for item in history_payload)

    delete_progress = client.delete(f"/api/me/progress/{title.id}", headers={"Authorization": f"Bearer {alice_token}", "X-Profile-Id": str(alice_profile_id)})
    assert delete_progress.status_code == 200
    assert Progress.query.filter_by(profile_id=alice_profile_id, title_id=title.id).count() == 0


def test_email_verification_and_password_reset_tokens_are_one_time(client, monkeypatch):
    import routes.auth as auth_routes

    delivered = []
    monkeypatch.setattr(auth_routes, "send_account_link", lambda user, token, purpose: delivered.append((token, purpose)))
    app.config.update(
        REQUIRE_EMAIL_VERIFICATION=True,
        SMTP_HOST="mail.example.test",
        SMTP_FROM="vortex@example.test",
    )
    registered = client.post(
        "/api/auth/register",
        json={"email": "verified@example.com", "password": "secret123", "name": "Viewer"},
    )
    assert registered.status_code == 201
    assert registered.get_json()["verification_required"] is True
    assert client.post(
        "/api/auth/login",
        json={"email": "verified@example.com", "password": "secret123"},
    ).status_code == 403

    verification_token, purpose = delivered[-1]
    assert purpose == "verify_email"
    verified = client.post("/api/auth/verification/confirm", json={"token": verification_token})
    assert verified.status_code == 200
    assert client.post("/api/auth/verification/confirm", json={"token": verification_token}).status_code == 400
    assert AccountSecurity.query.filter_by(email_verified=True).count() == 1

    app.config["REQUIRE_EMAIL_VERIFICATION"] = False
    reset_requested = client.post("/api/auth/password/forgot", json={"email": "verified@example.com"})
    assert reset_requested.status_code == 202
    reset_token, purpose = delivered[-1]
    assert purpose == "password_reset"
    reset = client.post(
        "/api/auth/password/reset",
        json={"token": reset_token, "password": "a-new-password"},
    )
    assert reset.status_code == 200
    assert client.post(
        "/api/auth/password/reset",
        json={"token": reset_token, "password": "another-password"},
    ).status_code == 400
    assert client.post(
        "/api/auth/login",
        json={"email": "verified@example.com", "password": "a-new-password"},
    ).status_code == 200


def test_password_change_revokes_sessions_and_account_can_be_deleted(client):
    registered = client.post(
        "/api/auth/register",
        json={"email": "security@example.com", "password": "secret123", "name": "Viewer"},
    )
    token = registered.get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    changed = client.post(
        "/api/auth/password/change",
        headers=headers,
        json={"current_password": "secret123", "new_password": "a-new-password"},
    )
    assert changed.status_code == 200
    assert client.get("/api/auth/me", headers=headers).status_code == 401

    login = client.post(
        "/api/auth/login",
        json={"email": "security@example.com", "password": "a-new-password"},
    )
    current_token = login.get_json()["token"]
    current_headers = {"Authorization": f"Bearer {current_token}"}
    assert client.post("/api/auth/sessions/revoke", headers=current_headers).status_code == 200
    assert client.get("/api/auth/me", headers=current_headers).status_code == 401

    fresh_login = client.post(
        "/api/auth/login",
        json={"email": "security@example.com", "password": "a-new-password"},
    )
    fresh_headers = {"Authorization": f"Bearer {fresh_login.get_json()['token']}"}
    deleted = client.delete("/api/auth/me", headers=fresh_headers, json={"password": "a-new-password"})
    assert deleted.status_code == 200
    assert User.query.filter_by(email="security@example.com").first() is None


def test_active_sessions_can_be_listed_and_revoked_individually(client):
    registration = client.post(
        "/api/auth/register",
        json={"email": "sessions@example.com", "password": "secret123", "name": "Viewer"},
        headers={"User-Agent": "Vortex Test Browser"},
    ).get_json()
    current_headers = {"Authorization": f"Bearer {registration['token']}"}
    second_login = client.post(
        "/api/auth/login",
        json={"email": "sessions@example.com", "password": "secret123"},
        headers={"User-Agent": "Vortex Other Browser"},
    ).get_json()
    other_headers = {"Authorization": f"Bearer {second_login['token']}"}

    sessions = client.get("/api/auth/sessions", headers=current_headers).get_json()
    assert len(sessions) == 2
    other = next(session for session in sessions if not session["current"])
    assert other["user_agent"] == "Vortex Other Browser"
    revoked = client.delete(f"/api/auth/sessions/{other['id']}", headers=current_headers)
    assert revoked.status_code == 200
    assert client.get("/api/auth/me", headers=other_headers).status_code == 401
    remaining = client.get("/api/auth/sessions", headers=current_headers).get_json()
    assert len(remaining) == 1
    assert remaining[0]["current"] is True


def test_reports_playback_metrics_recommendations_and_watched_episodes(client):
    viewer = client.post(
        "/api/auth/register",
        json={"email": "viewer@example.com", "password": "secret123", "name": "Viewer"},
    ).get_json()
    viewer_headers = {
        "Authorization": f"Bearer {viewer['token']}",
        "X-Profile-Id": str(viewer["profiles"][0]["id"]),
    }
    genre = Genre(name="Mystery", slug="mystery")
    anchor = Title(type="anime", title="Mystery One", video_url="https://example.test/one.mp4", genres=[genre])
    related = Title(type="anime", title="Mystery Two", video_url="https://example.test/two.mp4", genres=[genre])
    db.session.add_all([anchor, related])
    db.session.flush()
    episode = Episode(title_id=anchor.id, season=1, number=1, name="First", video_url="https://example.test/episode.mp4")
    db.session.add(episode)
    db.session.commit()

    assert client.post("/api/me/playback-events", headers=viewer_headers, json={"event_type": "play", "title_id": anchor.id, "episode_id": episode.id}).status_code == 201
    assert client.post("/api/me/playback-events", headers=viewer_headers, json={"event_type": "error", "title_id": anchor.id, "episode_id": episode.id, "error_code": "decode"}).status_code == 201
    assert client.put(
        "/api/me/progress",
        headers=viewer_headers,
        json={"title_id": anchor.id, "episode_id": episode.id, "position": 96, "duration": 100},
    ).status_code == 200
    assert episode.id in client.get("/api/me/watched-episodes", headers=viewer_headers).get_json()
    assert client.put(f"/api/me/ratings/{anchor.id}", headers=viewer_headers, json={"rating": 1}).status_code == 200
    recommendations = client.get(f"/api/me/recommendations/{anchor.id}", headers=viewer_headers).get_json()
    assert recommendations[0]["id"] == related.id
    assert client.post(
        "/api/me/reports",
        headers=viewer_headers,
        json={"title_id": anchor.id, "episode_id": episode.id, "category": "broken_video", "details": "Cannot load."},
    ).status_code == 201

    admin = User(email="admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()
    admin_token = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "adminpass"}).get_json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    assert client.get("/api/admin/reports", headers=admin_headers).get_json()[0]["title"] == anchor.title
    stats = client.get("/api/admin/analytics/playback", headers=admin_headers).get_json()
    assert next(item for item in stats if item["title_id"] == anchor.id)["errors"] == 1


def test_scheduled_anime_metadata_franchise_and_new_episode_notifications(client):
    admin = User(email="admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()
    admin_token = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "adminpass"}).get_json()["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    created = client.post(
        "/api/admin/titles",
        headers=admin_headers,
        json={
            "type": "anime",
            "title": "Sky Beyond",
            "description": "A test anime.",
            "video_url": "https://example.test/sky.mp4",
            "airing_status": "airing",
            "audio_mode": "both",
            "franchise_name": "Sky Saga",
            "publish_at": future,
            "cast": ["Voice Actor"],
        },
    )
    assert created.status_code == 201, created.get_data(as_text=True)
    title_id = created.get_json()["id"]
    assert client.get("/api/titles?q=Sky%20Beyond").get_json() == []
    admin_titles = client.get("/api/admin/titles", headers=admin_headers).get_json()
    assert next(item for item in admin_titles if item["id"] == title_id)["airing_status"] == "airing"
    assert client.put(
        f"/api/admin/titles/{title_id}",
        headers=admin_headers,
        json={"publish_at": None},
    ).status_code == 200

    viewer = client.post(
        "/api/auth/register",
        json={"email": "anime-viewer@example.com", "password": "secret123", "name": "Viewer"},
    ).get_json()
    viewer_headers = {
        "Authorization": f"Bearer {viewer['token']}",
        "X-Profile-Id": str(viewer["profiles"][0]["id"]),
    }
    assert client.get("/api/me/notifications/new-episodes", headers=viewer_headers).get_json()["count"] == 0
    added = client.post(
        f"/api/admin/titles/{title_id}/episodes",
        headers=admin_headers,
        json={"name": "Episode One", "video_url": "https://example.test/one.mp4", "audio_mode": "dub"},
    )
    assert added.status_code == 201
    assert added.get_json()["audio_mode"] == "dub"
    assert client.get("/api/me/notifications/new-episodes", headers=viewer_headers).get_json()["count"] == 1
    assert client.get("/api/me/notifications/new-episodes", headers=viewer_headers).get_json()["count"] == 0
    details = client.get(f"/api/titles/{title_id}").get_json()
    assert details["cast"] == ["Voice Actor"]
    assert details["audio_mode"] == "both"
    assert details["episodes"][0]["is_new"] is True
    browse_rows = client.get("/api/browse").get_json()
    assert browse_rows[0]["key"] == "top-10"
    assert any(row["label"] == "Sky Saga" for row in browse_rows)


def test_browse_facets_filters_and_sorting_include_studio_audio_and_status(client):
    admin = User(email="catalog-admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()
    token = client.post(
        "/api/auth/login",
        json={"email": "catalog-admin@example.com", "password": "adminpass"},
    ).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    for payload in [
        {
            "type": "anime", "title": "Sky Journey", "description": "Drama.",
            "video_url": "https://example.test/sky.mp4", "year": 2024, "genres": ["Drama"],
            "studios": ["Blue Studio"], "audio_mode": "dub", "airing_status": "airing", "popularity": 20,
        },
        {
            "type": "series", "title": "Night Stories", "description": "Drama.",
            "video_url": "https://example.test/night.mp4", "year": 2020, "genres": ["Drama"],
            "studios": ["North Studio"], "audio_mode": "sub", "airing_status": "completed", "popularity": 80,
        },
    ]:
        assert client.post("/api/admin/titles", headers=headers, json=payload).status_code == 201

    facets = client.get("/api/browse/facets").get_json()
    assert 2024 in facets["years"] and 2020 in facets["years"]
    assert {studio["slug"] for studio in facets["studios"]} == {"blue-studio", "north-studio"}
    result = client.get(
        "/api/browse/titles?genre=drama&year=2024&studio=blue-studio&audio_mode=dub&status=airing"
    )
    assert result.status_code == 200
    assert result.get_json()["total"] == 1
    assert result.get_json()["items"][0]["title"] == "Sky Journey"
    assert result.get_json()["items"][0]["studios"] == ["Blue Studio"]
    sorted_results = client.get("/api/browse/titles?sort=title-desc").get_json()["items"]
    assert [item["title"] for item in sorted_results] == ["Sky Journey", "Night Stories"]
    first_page = client.get("/api/browse/titles?sort=title-asc&limit=1&offset=0").get_json()
    second_page = client.get("/api/browse/titles?sort=title-asc&limit=1&offset=1").get_json()
    assert first_page["total"] == second_page["total"] == 2
    assert first_page["items"][0]["title"] != second_page["items"][0]["title"]
    assert client.get("/api/browse/titles?audio_mode=invalid").status_code == 400


def test_episode_segment_markers_are_saved_and_validated(client):
    admin = User(email="segment-admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()
    token = client.post(
        "/api/auth/login",
        json={"email": "segment-admin@example.com", "password": "adminpass"},
    ).get_json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    title = client.post(
        "/api/admin/titles",
        headers=headers,
        json={"type": "anime", "title": "Marked Anime", "video_url": "https://example.test/unused.mp4"},
    ).get_json()
    added = client.post(
        f"/api/admin/titles/{title['id']}/episodes",
        headers=headers,
        json={
            "name": "Episode 1",
            "video_url": "https://example.test/episode.mp4",
            "intro_start": 30,
            "intro_end": 90,
            "recap_start": 90,
            "recap_end": 120,
            "credits_start": 130,
        },
    )
    assert added.status_code == 201
    episode = added.get_json()
    assert episode["intro_end"] == 90
    assert episode["recap_start"] == 90
    assert episode["credits_start"] == 130

    updated = client.put(
        f"/api/admin/episodes/{episode['id']}",
        headers=headers,
        json={"credits_start": 140},
    )
    assert updated.status_code == 200
    assert updated.get_json()["credits_start"] == 140
    invalid = client.put(
        f"/api/admin/episodes/{episode['id']}",
        headers=headers,
        json={"intro_start": 100},
    )
    assert invalid.status_code == 400
    persisted = client.get(f"/api/admin/titles/{title['id']}", headers=headers).get_json()["episodes"][0]
    assert persisted["intro_start"] == 30
    assert persisted["credits_start"] == 140


def test_profiles_can_mark_all_series_episodes_watched(client):
    viewer = client.post(
        "/api/auth/register",
        json={"email": "watch-all@example.com", "password": "secret123", "name": "Viewer"},
    ).get_json()
    headers = {
        "Authorization": f"Bearer {viewer['token']}",
        "X-Profile-Id": str(viewer["profiles"][0]["id"]),
    }
    title = Title(type="anime", title="Complete Series")
    db.session.add(title)
    db.session.flush()
    episodes = [
        Episode(title_id=title.id, season=1, number=number, name=f"Episode {number}", video_url=f"https://example.test/{number}.mp4")
        for number in range(1, 4)
    ]
    db.session.add_all(episodes)
    db.session.commit()

    response = client.post(f"/api/me/titles/{title.id}/watched-episodes", headers=headers, json={})
    assert response.status_code == 200
    expected_ids = {episode.id for episode in episodes}
    assert set(response.get_json()["episode_ids"]) == expected_ids
    assert set(client.get("/api/me/watched-episodes", headers=headers).get_json()).issuperset(expected_ids)
    client.post(f"/api/me/titles/{title.id}/watched-episodes", headers=headers, json={})
    assert WatchedEpisode.query.filter_by(profile_id=viewer["profiles"][0]["id"], title_id=title.id).count() == 3

    movie = Title(type="movie", title="Not a series", video_url="https://example.test/movie.mp4")
    db.session.add(movie)
    db.session.commit()
    assert client.post(f"/api/me/titles/{movie.id}/watched-episodes", headers=headers, json={}).status_code == 404


def test_episode_progress_is_retained_per_episode_and_profile(client):
    viewer = client.post(
        "/api/auth/register",
        json={"email": "episode-progress@example.com", "password": "secret123", "name": "Viewer"},
    ).get_json()
    headers = {
        "Authorization": f"Bearer {viewer['token']}",
        "X-Profile-Id": str(viewer["profiles"][0]["id"]),
    }
    title = Title(type="anime", title="Progress Show")
    db.session.add(title)
    db.session.flush()
    first = Episode(title_id=title.id, season=1, number=1, name="First", video_url="https://example.test/first.mp4")
    second = Episode(title_id=title.id, season=1, number=2, name="Second", video_url="https://example.test/second.mp4")
    db.session.add_all([first, second])
    db.session.commit()

    for episode, position in ((first, 30), (second, 45)):
        response = client.put(
            "/api/me/progress",
            headers=headers,
            json={"title_id": title.id, "episode_id": episode.id, "position": position, "duration": 100},
        )
        assert response.status_code == 200

    response = client.get(f"/api/me/titles/{title.id}/episode-progress", headers=headers)
    assert response.status_code == 200
    assert response.get_json() == {
        str(first.id): {"position": 30, "duration": 100},
        str(second.id): {"position": 45, "duration": 100},
    }
    assert EpisodeProgress.query.filter_by(title_id=title.id).count() == 2
