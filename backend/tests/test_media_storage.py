import io
from urllib.parse import urlparse

import pytest

from app import app
from extensions import db, limiter
from models import MediaAsset, Title, User


@pytest.fixture
def client(tmp_path):
    previous_limiter_state = limiter.enabled
    limiter.enabled = False
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI="sqlite://",
        MEDIA_ROOT=str(tmp_path / "media"),
        MEDIA_SCAN_ROOTS=[],
        RATELIMIT_ENABLED=False,
        SUPABASE_URL="",
        SUPABASE_SERVICE_ROLE_KEY="",
        SUPABASE_PUBLIC_URL="",
        SUPABASE_BUCKET="vortex-media",
    )
    with app.app_context():
        db.drop_all()
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()
        limiter.enabled = previous_limiter_state


def _admin_token(client):
    admin = User(email="admin@example.com", is_admin=True)
    admin.set_password("adminpass")
    db.session.add(admin)
    db.session.commit()
    response = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "adminpass"})
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()["token"]


def test_local_media_upload_records_asset(client):
    token = _admin_token(client)

    response = client.post(
        "/api/media/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "kind": "poster",
            "storage_provider": "local",
            "file": (io.BytesIO(b"fake-image-data"), "poster.jpg"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    payload = response.get_json()
    assert payload["provider"] == "local"
    assert payload["url"].startswith("/media/poster/")
    assert MediaAsset.query.count() == 1

    list_response = client.get("/api/media/assets", headers={"Authorization": f"Bearer {token}"})
    assert list_response.status_code == 200
    assets = list_response.get_json()
    assert len(assets) == 1
    assert assets[0]["file_type"] == "poster"


def test_local_video_upload_accepts_mp4(client):
    token = _admin_token(client)

    response = client.post(
        "/api/media/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "kind": "video",
            "file": (io.BytesIO(b"fake-video-data"), "movie.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    assert response.get_json()["url"].startswith("/media/video/")
    assert MediaAsset.query.filter_by(file_type="video").count() == 1


def test_linked_media_uses_signed_url_and_hides_public_upload_path(client):
    token = _admin_token(client)
    uploaded = client.post(
        "/api/media/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={"kind": "video", "file": (io.BytesIO(b"private-video"), "private.mp4")},
        content_type="multipart/form-data",
    )
    asset = uploaded.get_json()
    created = client.post(
        "/api/admin/titles",
        headers={"Authorization": f"Bearer {token}"},
        json={"type": "movie", "title": "Private Movie", "video_url": asset["url"], "video_asset_id": asset["asset_id"]},
    )
    assert created.status_code == 201
    title = client.get(f"/api/titles/{created.get_json()['id']}").get_json()
    assert title["video_url"] is None
    assert title["video_asset_id"] == asset["asset_id"]

    direct = client.get(asset["url"])
    assert direct.status_code == 403
    signed = client.get(
        f"/api/media/assets/{asset['asset_id']}/playback",
        headers={"Authorization": f"Bearer {token}"},
    ).get_json()["url"]
    playback = client.get(signed)
    assert playback.status_code == 200
    assert playback.data == b"private-video"
    parsed = urlparse(signed)
    expired = client.get(f"{parsed.path}?expires=1&signature=invalid")
    assert expired.status_code == 403


def test_local_hls_playlist_signs_segments_and_rejects_path_escape(client, tmp_path, monkeypatch):
    monkeypatch.setitem(app.config, "MEDIA_ROOT", str(tmp_path))
    token = _admin_token(client)
    media_dir = tmp_path / "video" / "show"
    media_dir.mkdir(parents=True)
    (media_dir / "index.m3u8").write_text("#EXTM3U\n#EXTINF:4,\nsegment.ts\n", encoding="utf-8")
    (media_dir / "segment.ts").write_bytes(b"segment-data")
    asset = MediaAsset(storage_provider="local", file_path="video/show/index.m3u8", file_type="video", file_size=20)
    db.session.add(asset)
    db.session.commit()
    playback_url = client.get(
        f"/api/media/assets/{asset.id}/playback",
        headers={"Authorization": f"Bearer {token}"},
    ).get_json()["url"]

    playlist = client.get(playback_url)
    assert playlist.status_code == 200
    segment_url = playlist.get_data(as_text=True).splitlines()[-1]
    assert "signature=" in segment_url
    assert client.get(segment_url).data == b"segment-data"

    (media_dir / "index.m3u8").write_text("#EXTM3U\n../../outside.ts\n", encoding="utf-8")
    assert client.get(playback_url).status_code == 400


def test_configured_library_scan_registers_and_signs_episode_files(client, tmp_path):
    root = tmp_path / "library"
    root.mkdir()
    media_file = root / "Moon Academy S01E03 - First Flight.mkv"
    media_file.write_bytes(b"scanned-video")
    app.config["MEDIA_SCAN_ROOTS"] = [str(root)]
    token = _admin_token(client)
    headers = {"Authorization": f"Bearer {token}"}

    scan = client.post("/api/media/scan", headers=headers, json={"root_index": 0, "type": "anime"})
    assert scan.status_code == 200
    assert scan.get_json() == {"created_titles": 1, "created_episodes": 1, "skipped_existing": True}
    assert client.post("/api/media/scan", headers=headers, json={"root_index": 0, "type": "anime"}).get_json()["created_episodes"] == 0

    title_summary = client.get("/api/admin/titles", headers=headers).get_json()[0]
    title = client.get(f"/api/admin/titles/{title_summary['id']}", headers=headers).get_json()
    episode = title["episodes"][0]
    assert title["title"] == "Moon Academy"
    assert episode["video_url"] is None
    assert episode["video_asset_id"]
    playback_url = client.get(
        f"/api/media/assets/{episode['video_asset_id']}/playback",
        headers=headers,
    ).get_json()["url"]
    assert client.get(playback_url).data == b"scanned-video"


def test_media_upload_rejects_invalid_provider(client):
    token = _admin_token(client)

    response = client.post(
        "/api/media/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "kind": "video",
            "storage_provider": "ftp",
            "file": (io.BytesIO(b"fake-video-data"), "movie.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "Unsupported storage provider" in response.get_json()["error"]


def test_supabase_upload_requires_configuration(client):
    token = _admin_token(client)

    response = client.post(
        "/api/media/upload",
        headers={"Authorization": f"Bearer {token}"},
        data={
            "kind": "video",
            "storage_provider": "supabase",
            "file": (io.BytesIO(b"fake-video-data"), "movie.mp4"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert "Supabase storage is not configured" in response.get_json()["error"]
