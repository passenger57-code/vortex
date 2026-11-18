import smtplib
from email.message import EmailMessage
from urllib.parse import quote

from flask import current_app


def email_is_configured():
    return bool(current_app.config.get("SMTP_HOST") and current_app.config.get("SMTP_FROM"))


def send_account_link(user, token, purpose):
    if purpose == "verify_email":
        path = "/verify-email"
        subject = "Verify your Vortex email"
        action = "Verify email"
        intro = "Confirm your email address to finish setting up your Vortex account."
    elif purpose == "password_reset":
        path = "/auth"
        subject = "Reset your Vortex password"
        action = "Reset password"
        intro = "Use this one-time link to choose a new Vortex password."
    else:
        raise ValueError("Unsupported account email purpose.")

    url = f"{current_app.config['APP_BASE_URL']}{path}?token={quote(token)}"
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = current_app.config["SMTP_FROM"]
    message["To"] = user.email
    message.set_content(
        f"{intro}\n\n{action}: {url}\n\n"
        "This link expires soon and can only be used once. If you did not request it, "
        "you can ignore this message."
    )

    host = current_app.config["SMTP_HOST"]
    port = current_app.config["SMTP_PORT"]
    timeout = 15
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=timeout) as server:
            _send(server, message)
    else:
        with smtplib.SMTP(host, port, timeout=timeout) as server:
            server.starttls()
            _send(server, message)


def _send(server, message):
    username = current_app.config.get("SMTP_USERNAME")
    password = current_app.config.get("SMTP_PASSWORD")
    if username:
        server.login(username, password or "")
    server.send_message(message)
