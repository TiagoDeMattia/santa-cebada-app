"""
Notificaciones Telegram para Panel 85 & 86.
Fire-and-forget: no bloquea la respuesta de la API.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
import requests as _requests
from ..config.settings import settings

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="tg")


def _token() -> str:
    return settings.telegram_bot_token


def _chat_ids() -> list[str]:
    raw = settings.telegram_chat_ids
    return [c.strip() for c in raw.split(",") if c.strip()]


def _send_blocking(text: str) -> None:
    token = _token()
    chats = _chat_ids()
    if not token or not chats:
        logger.warning("telegram_service: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_IDS no configurados")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    for chat_id in chats:
        try:
            r = _requests.post(
                url,
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=10,
            )
            if not r.ok:
                logger.warning(f"telegram_service: error {r.status_code} al enviar a {chat_id}: {r.text[:200]}")
        except Exception as e:
            logger.warning(f"telegram_service: excepción enviando a {chat_id}: {e}")


def notify(text: str) -> None:
    """Envía el mensaje en background, sin bloquear."""
    _executor.submit(_send_blocking, text)


def notify_alerta(nombre: str, tipo_anterior, tipo_nuevo, updated_by: str | None = None, nota: str | None = None) -> None:
    """Construye y envía el mensaje según el cambio de tipo."""
    if tipo_anterior == tipo_nuevo:
        return

    quien = f"\n👤 <i>{updated_by}</i>" if updated_by else ""
    obs = f"\n📝 <i>{nota}</i>" if nota else ""

    if tipo_nuevo == 86:
        msg = f"🔴 <b>86 — SIN STOCK</b>\n📦 {nombre}{obs}{quien}"
    elif tipo_nuevo == 85:
        msg = f"🟡 <b>85 — BAJO STOCK</b>\n📦 {nombre}{obs}{quien}"
    else:
        prev = f" (era {'86' if tipo_anterior == 86 else '85'})" if tipo_anterior else ""
        msg = f"✅ <b>Volvió al stock{prev}</b>\n📦 {nombre}{quien}"

    notify(msg)
