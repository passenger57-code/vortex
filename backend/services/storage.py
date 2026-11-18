import json
import os
import uuid
from urllib import request
from urllib.error import HTTPError, URLError
from urllib.parse import quote

from flask import current_app


class StorageService:
    @staticmethod
    def allowed_providers():
        providers = {"local"}
        if current_app.config.get("SUPABASE_URL") and current_app.config.get("SUPABASE_SERVICE_ROLE_KEY"):
            providers.add("supabase")
        return providers

    @staticmethod
    def normalize_provider(provider):
        value = (provider or "local").strip().lower()
        if value == "supabase":
            return value
        if value not in StorageService.allowed_providers():
            raise ValueError(f"Unsupported storage provider '{provider}'. Allowed: {', '.join(sorted(StorageService.allowed_providers()))}.")
        return value

    @staticmethod
    def local_upload(kind, upload):
        upload.stream.seek(0, os.SEEK_END)
        size = upload.stream.tell()
        upload.stream.seek(0)
        ext = os.path.splitext(os.path.basename(upload.filename))[1].lower()
        media_root = os.path.abspath(current_app.config.get("MEDIA_ROOT") or os.path.join(os.path.dirname(__file__), "..", "media"))
        target_dir = os.path.join(media_root, kind)
        os.makedirs(target_dir, exist_ok=True)
        filename = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(target_dir, filename)
        upload.save(path)
        return f"/media/{kind}/{filename}", os.path.relpath(path, media_root).replace(os.sep, "/")

    @staticmethod
    def supabase_upload(kind, upload):
        if not current_app.config.get("SUPABASE_URL") or not current_app.config.get("SUPABASE_SERVICE_ROLE_KEY"):
            raise ValueError("Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

        ext = os.path.splitext(os.path.basename(upload.filename))[1].lower()
        object_path = f"{kind}/{uuid.uuid4().hex}{ext}"
        bucket = current_app.config.get("SUPABASE_BUCKET", "vortex-media")
        base_url = current_app.config["SUPABASE_URL"].rstrip("/")
        public_url = (current_app.config.get("SUPABASE_PUBLIC_URL") or base_url).rstrip("/")
        upload.stream.seek(0)
        payload = upload.read()

        api_url = f"{base_url}/storage/v1/object/{bucket}/{object_path}"
        req = request.Request(
            api_url,
            data=payload,
            method="POST",
            headers={
                "Authorization": f"Bearer {current_app.config['SUPABASE_SERVICE_ROLE_KEY']}",
                "apikey": current_app.config["SUPABASE_SERVICE_ROLE_KEY"],
                "Content-Type": upload.mimetype or "application/octet-stream",
                "x-upsert": "false",
            },
        )
        try:
            with request.urlopen(req, timeout=30) as resp:
                resp.read()
        except (HTTPError, URLError) as exc:
            body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else str(exc)
            raise ValueError(f"Supabase upload failed: {body or exc}") from exc

        return f"{public_url}/storage/v1/object/public/{bucket}/{object_path}", object_path

    @staticmethod
    def supabase_signed_url(bucket, object_path, expires_in):
        base_url = current_app.config.get("SUPABASE_URL", "").rstrip("/")
        service_key = current_app.config.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not base_url or not service_key:
            raise ValueError("Supabase storage is not configured.")
        encoded_bucket = quote(bucket, safe="")
        encoded_path = "/".join(quote(part, safe="") for part in object_path.split("/"))
        api_url = f"{base_url}/storage/v1/object/sign/{encoded_bucket}/{encoded_path}"
        req = request.Request(
            api_url,
            data=json.dumps({"expiresIn": expires_in}).encode("utf-8"),
            method="POST",
            headers={
                "Authorization": f"Bearer {service_key}",
                "apikey": service_key,
                "Content-Type": "application/json",
            },
        )
        try:
            with request.urlopen(req, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, ValueError) as exc:
            body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else str(exc)
            raise ValueError(f"Unable to create a Supabase playback URL: {body or exc}") from exc
        signed = payload.get("signedURL") or payload.get("signedUrl")
        if not isinstance(signed, str) or not signed:
            raise ValueError("Supabase did not return a signed playback URL.")
        if signed.startswith("http://") or signed.startswith("https://"):
            return signed
        if signed.startswith("/storage/v1/"):
            return f"{base_url}{signed}"
        return f"{base_url}/storage/v1{signed if signed.startswith('/') else '/' + signed}"
