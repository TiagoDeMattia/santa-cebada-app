import os
import re
import unicodedata
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pandas as pd

LOCAL_TIMEZONE = ZoneInfo("America/Argentina/Buenos_Aires")
UTC_TIMEZONE = ZoneInfo("UTC")

SHIFT_START_HOUR = 8
SHIFT_END_HOUR = 3
BUSINESS_DAY_CUTOFF_HOUR = SHIFT_END_HOUR

DEFAULT_HISTORY_START_DATE = date(2025, 1, 1)
DEFAULT_APP_LOGIN_USER = "Santa Cebada"

PAYMENT_CATEGORY_MAP = {
    "efectivo": "Efectivo",
    "cash": "Efectivo",
    "mercado pago": "Mercado Pago",
    "mercadopago": "Mercado Pago",
    "qr": "Mercado Pago",
    "vale": "Vales",
    "vales": "Vales",
    "debito": "Debito",
    "debit": "Debito",
    "credito": "Credito",
    "credit": "Credito",
    "transfer": "Transferencia",
    "transferencia": "Transferencia",
}

CHART_COLORS = {
    "Efectivo": "#D97A2B",
    "Mercado Pago": "#009EE3",
    "Vales": "#7A8A3A",
    "Debito": "#1F5D50",
    "Credito": "#6B4EFF",
    "Transferencia": "#8E5E3B",
    "Otros": "#6C757D",
}

RUBRO_RULES = {
    "adicionales": {"phrases": [], "tokens": ["adicional", "cheddar", "moretti"]},
    "tragos": {
        "phrases": ["frutos rojos"],
        "tokens": [
            "fernet",
            "vermouth",
            "gin",
            "campari",
            "aperol",
            "negroni",
            "cynar",
            "mojito",
            "daiquiri",
            "vodka",
            "ron",
            "whisky",
            "whiskey",
            "spritz",
            "tonic",
            "caipi",
            "caipiroshka",
            "americano",
        ],
    },
    "cervezas": {
        "phrases": [
            "barley wine",
            "red ale",
            "honey ale",
            "pinta hora santa",
            "botella amber",
        ],
        "tokens": [
            "canilla",
            "pinta",
            "ipa",
            "apa",
            "neipa",
            "lager",
            "stout",
            "porter",
            "pilsen",
            "pils",
            "scottish",
            "golden",
            "cream",
            "ale",
            "cerveza",
            "beer",
            "amber",
            "sour",
        ],
    },
    "sin alcohol": {
        "phrases": [],
        "tokens": ["agua", "sprite", "jugo", "limonada", "gaseosa", "naranja"],
    },
    "hamburguesas": {"phrases": [], "tokens": ["burger", "hamburguesa"]},
    "entradas": {
        "phrases": [],
        "tokens": ["empanada", "papas", "tequenos", "teque", "tabla", "picada"],
    },
    "pizzas": {"phrases": [], "tokens": ["pizza", "muzza"]},
    "pastas": {
        "phrases": [],
        "tokens": ["ravioles", "pasta", "sorrentinos", "gnocchi", "noquis"],
    },
    "ensaladas": {"phrases": [], "tokens": ["ensalada"]},
    "platos": {
        "phrases": [],
        "tokens": ["sandwich", "sanguche", "wrap", "milanesa", "focaccia", "tostado", "pollo", "crispy"],
    },
    "postres": {"phrases": [], "tokens": ["postre", "flan", "brownie", "cheesecake", "tiramisu"]},
    "menu ejecutivo": {"phrases": ["menu ejecutivo"], "tokens": ["ejecutivo"]},
}

MATCH_RUBRO_ORDER = [
    "menu ejecutivo",
    "adicionales",
    "tragos",
    "cervezas",
    "sin alcohol",
    "hamburguesas",
    "entradas",
    "pizzas",
    "pastas",
    "ensaladas",
    "platos",
    "postres",
]

RUBRO_ORDER = [
    "cervezas",
    "tragos",
    "sin alcohol",
    "hamburguesas",
    "entradas",
    "pizzas",
    "pastas",
    "ensaladas",
    "platos",
    "menu ejecutivo",
    "adicionales",
    "postres",
    "otros",
]


def get_runtime_setting(name, default_value=None):
    value = os.getenv(name)
    if value not in (None, ""):
        return str(value)

    try:
        import streamlit as st

        secret_value = st.secrets.get(name)
        if secret_value not in (None, ""):
            return str(secret_value)
    except Exception:
        pass

    return default_value


def parse_config_date(value):
    normalized = str(value or "").strip()
    if not normalized:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(normalized, fmt).date()
        except ValueError:
            continue
    return None


def get_history_start_date():
    configured = parse_config_date(get_runtime_setting("HISTORY_START_DATE"))
    return configured or DEFAULT_HISTORY_START_DATE


def normalize_text(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii")
    return " ".join(text.lower().split())


def tokenize_text(value):
    return [token for token in re.split(r"[^a-z0-9]+", value) if token]


def infer_rubro(product_name):
    normalized_name = normalize_text(product_name)
    tokens = set(tokenize_text(normalized_name))
    for rubro in MATCH_RUBRO_ORDER:
        rules = RUBRO_RULES[rubro]
        if any(phrase in normalized_name for phrase in rules["phrases"]):
            return rubro
        if any(token in tokens for token in rules["tokens"]):
            return rubro
    return "otros"


def parse_numeric_value(value):
    text = str(value or "").strip()
    if not text:
        return 0.0

    text = re.sub(r"[^0-9,.\-]", "", text)
    if not text or text in {"-", ".", ",", "-.", "-,"}:
        return 0.0

    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        integer_part, decimal_part = text.rsplit(",", 1)
        if len(decimal_part) <= 2:
            text = integer_part.replace(".", "") + "." + decimal_part
        else:
            text = text.replace(",", "")
    elif text.count(".") > 1:
        integer_part, decimal_part = text.rsplit(".", 1)
        if len(decimal_part) <= 2:
            text = integer_part.replace(".", "") + "." + decimal_part
        else:
            text = text.replace(".", "")

    try:
        return float(text)
    except ValueError:
        return 0.0


def map_payment_category(value):
    normalized = normalize_text(value)
    for pattern, label in PAYMENT_CATEGORY_MAP.items():
        if pattern in normalized:
            return label
    return "Otros"


def compute_business_date(value, assume_timezone=LOCAL_TIMEZONE):
    timestamp = pd.to_datetime(value, errors="coerce")
    if pd.isna(timestamp):
        return pd.NaT

    if getattr(timestamp, "tzinfo", None) is None:
        timestamp = timestamp.tz_localize(assume_timezone)
        if assume_timezone != LOCAL_TIMEZONE:
            timestamp = timestamp.tz_convert(LOCAL_TIMEZONE)
    else:
        timestamp = timestamp.tz_convert(LOCAL_TIMEZONE)

    if timestamp.hour < BUSINESS_DAY_CUTOFF_HOUR:
        return (timestamp - timedelta(days=1)).date()
    return timestamp.date()
