"""
Motor de predicción de ventas.
Modelos: WeightedDOW (baseline), HoltWinters, SARIMA, RandomForest, XGBoost, LightGBM.
Selección automática por MAPE en walk-forward validation.
"""
import warnings
warnings.filterwarnings("ignore")

import sqlite3
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

_DB_PATH = Path(__file__).parent.parent.parent / "nucleocheck.db"

# Caché en memoria: key → (timestamp, result)
_CACHE: Dict[str, Tuple[float, Any]] = {}
_CACHE_TTL = 1800  # 30 minutos

_DOW_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


def _location_key_from_sucursal_pred(sucursal_id: str) -> str:
    mapping = {"1": "recoleta", "recoleta": "recoleta"}
    return mapping.get(str(sucursal_id).lower(), "recoleta")


# ─── CARGA DE DATOS ───────────────────────────────────────────────────────────

_SUNDAY_DOW = 6  # pandas: Mon=0 ... Sun=6

def _load_daily(location_key: str = "recoleta") -> pd.DataFrame:
    """
    Facturación y pedidos diarios por DÍA DE NEGOCIO.

    El turno noche es 16:00-03:00, por lo que pedidos de madrugada (00:00-02:59)
    pertenecen al día de negocio anterior. Se implementa restando 3 horas al
    timestamp antes de agrupar por fecha.

    Usa la tabla 'pedidos' (266K registros, 2020-2026) para historial completo.
    Los domingos están cerrados la mayoría de las semanas; los pocos que aparecen
    son aperturas ocasionales (Dom 16:00 - Lun 03:00) y se conservan en los datos.
    """
    conn = sqlite3.connect(str(_DB_PATH))
    q = """
        SELECT DATE(datetime(fecha, '-3 hours')) as fecha,
               SUM(CAST(total_pagado as REAL))   as revenue,
               COUNT(*)                           as pedidos
        FROM pedidos
        WHERE location_key = ?
          AND fecha IS NOT NULL
          AND CAST(total_pagado as REAL) > 0
        GROUP BY DATE(datetime(fecha, '-3 hours'))
        ORDER BY fecha
    """
    df = pd.read_sql_query(q, conn, params=(location_key,))
    conn.close()
    df["fecha"] = pd.to_datetime(df["fecha"])
    df = df.set_index("fecha").sort_index()
    full_idx = pd.date_range(df.index.min(), df.index.max(), freq="D")
    df = df.reindex(full_idx, fill_value=0)
    df.index.name = "fecha"
    return df


def _load_products(location_key: str = "recoleta") -> pd.DataFrame:
    """
    Ventas por producto por día de negocio.

    period_start es el inicio del turno (ej. 2026-06-23T08:00:00), así que
    restar 3 horas da siempre la misma fecha de negocio (>= 05:00 del mismo día).
    """
    conn = sqlite3.connect(str(_DB_PATH))
    q = """
        SELECT DATE(datetime(period_start, '-3 hours')) as fecha, nombre,
               SUM(CAST(cantidad as REAL)) as qty,
               SUM(CAST(total as REAL)) as revenue
        FROM productos
        WHERE location_key = ?
          AND nombre IS NOT NULL AND nombre != ''
          AND CAST(cantidad as REAL) > 0
        GROUP BY DATE(datetime(period_start, '-3 hours')), nombre
        ORDER BY fecha
    """
    df = pd.read_sql_query(q, conn, params=(location_key,))
    conn.close()
    df["fecha"] = pd.to_datetime(df["fecha"])
    return df


def _load_payment_methods(location_key: str = "recoleta") -> pd.DataFrame:
    """Breakdown de formas de pago por día."""
    conn = sqlite3.connect(str(_DB_PATH))
    q = """
        SELECT DATE(fecha) as fecha, forma_pago,
               SUM(CAST(monto as REAL)) as monto,
               COUNT(*) as transacciones
        FROM formas_pago
        WHERE location_key = ? AND fecha IS NOT NULL
          AND CAST(monto as REAL) > 0
        GROUP BY DATE(fecha), forma_pago
        ORDER BY fecha
    """
    df = pd.read_sql_query(q, conn, params=(location_key,))
    conn.close()
    df["fecha"] = pd.to_datetime(df["fecha"])
    return df


# ─── FEATURE ENGINEERING ──────────────────────────────────────────────────────

def _make_features(series: pd.Series) -> pd.DataFrame:
    """Features de calendario + lags para modelos ML."""
    df = pd.DataFrame({"y": series.values}, index=series.index)
    df["dow"]         = df.index.dayofweek
    df["month"]       = df.index.month
    df["week"]        = df.index.isocalendar().week.astype(int)
    df["is_fri"]      = (df["dow"] == 4).astype(int)
    df["is_sat"]      = (df["dow"] == 5).astype(int)
    df["is_sun"]      = (df["dow"] == 6).astype(int)
    df["is_weekend"]  = (df["dow"] >= 4).astype(int)
    df["t"]           = np.arange(len(df))
    df["lag_7"]       = df["y"].shift(7)
    df["lag_14"]      = df["y"].shift(14)
    df["lag_21"]      = df["y"].shift(21)
    df["roll7_mean"]  = df["y"].shift(1).rolling(7, min_periods=3).mean()
    df["roll14_mean"] = df["y"].shift(1).rolling(14, min_periods=7).mean()
    df["roll7_std"]   = df["y"].shift(1).rolling(7, min_periods=3).std().fillna(0)
    return df.dropna()


def _future_features(last_date: pd.Timestamp, n: int, trend_slope: float,
                     trend_intercept: float, n_train: int) -> pd.DataFrame:
    """Features para días futuros (sin lags reales, usa rolling proyectado)."""
    dates = pd.date_range(last_date + timedelta(days=1), periods=n, freq="D")
    df = pd.DataFrame(index=dates)
    df["dow"]        = df.index.dayofweek
    df["month"]      = df.index.month
    df["week"]       = df.index.isocalendar().week.astype(int)
    df["is_fri"]     = (df["dow"] == 4).astype(int)
    df["is_sat"]     = (df["dow"] == 5).astype(int)
    df["is_sun"]     = (df["dow"] == 6).astype(int)
    df["is_weekend"] = (df["dow"] >= 4).astype(int)
    df["t"]          = np.arange(n_train, n_train + n)
    # Para lags y rolling usamos el valor de tendencia proyectado como aproximación
    for i, row in enumerate(df.itertuples()):
        trend_v = trend_slope * (n_train + i) + trend_intercept
        df.at[row.Index, "lag_7"]      = max(0, trend_v)
        df.at[row.Index, "lag_14"]     = max(0, trend_v)
        df.at[row.Index, "lag_21"]     = max(0, trend_v)
        df.at[row.Index, "roll7_mean"] = max(0, trend_v)
        df.at[row.Index, "roll14_mean"]= max(0, trend_v)
        df.at[row.Index, "roll7_std"]  = 0
    return df


# ─── MODELOS ──────────────────────────────────────────────────────────────────

class _WeightedDOW:
    name = "WeightedDOW"

    def __init__(self):
        self.dow_means_  = None
        self.slope_      = 0.0
        self.intercept_  = 0.0
        self.sigma_      = 0.0
        self.n_train_    = 0
        self.global_mean_= 1.0

    def fit(self, y: pd.Series):
        self.n_train_ = len(y)
        t = np.arange(len(y))
        A = np.vstack([t, np.ones(len(t))]).T
        self.slope_, self.intercept_ = np.linalg.lstsq(A, y.values, rcond=None)[0]
        self.dow_means_ = y.groupby(y.index.dayofweek).mean()
        self.global_mean_ = self.dow_means_.mean() or 1.0
        # residuals
        trend = self.slope_ * t + self.intercept_
        dow_ratio = np.array([self.dow_means_[d] / self.global_mean_ for d in y.index.dayofweek])
        pred = np.maximum(0, trend * dow_ratio)
        self.sigma_ = float(np.std(y.values - pred))
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        dates = pd.date_range(last_date + timedelta(days=1), periods=n, freq="D")
        means = []
        for i, d in enumerate(dates):
            t_i = self.n_train_ + i
            trend_v = self.slope_ * t_i + self.intercept_
            ratio = self.dow_means_.get(d.dayofweek, self.global_mean_) / self.global_mean_
            means.append(max(0, trend_v * ratio))
        means = np.array(means)
        lower = np.maximum(0, means - 1.96 * self.sigma_)
        upper = means + 1.96 * self.sigma_
        return means, lower, upper


class _HoltWinters:
    name = "HoltWinters"

    def __init__(self):
        self.model_ = None
        self.fit_   = None

    def fit(self, y: pd.Series):
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        self.model_ = ExponentialSmoothing(
            y.values.astype(float),
            trend="add", seasonal="add", seasonal_periods=7,
            initialization_method="estimated",
        )
        self.fit_ = self.model_.fit(optimized=True, remove_bias=False)
        self._sigma = float(np.std(self.fit_.resid))
        self._n = len(y)
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        pred = self.fit_.forecast(n)
        pred = np.maximum(0, pred)
        # Bootstrap CI via simulation
        try:
            sims = self.fit_.simulate(n, repetitions=200, error="add")
            lower = np.maximum(0, np.percentile(sims, 5, axis=1))
            upper = np.percentile(sims, 95, axis=1)
        except Exception:
            lower = np.maximum(0, pred - 1.96 * self._sigma)
            upper = pred + 1.96 * self._sigma
        return pred, lower, upper


class _SARIMA:
    name = "SARIMA"

    def __init__(self, order=(1,1,1), seasonal_order=(1,0,1,7)):
        self.order          = order
        self.seasonal_order = seasonal_order
        self.fit_           = None

    def fit(self, y: pd.Series):
        from statsmodels.tsa.statespace.sarimax import SARIMAX
        m = SARIMAX(y.values.astype(float), order=self.order,
                    seasonal_order=self.seasonal_order,
                    enforce_stationarity=False, enforce_invertibility=False)
        self.fit_ = m.fit(disp=False, maxiter=100)
        self._n   = len(y)
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        fc = self.fit_.get_forecast(steps=n)
        pred  = np.maximum(0, fc.predicted_mean)
        ci    = fc.conf_int(alpha=0.1)
        lower = np.maximum(0, ci[:, 0])
        upper = ci[:, 1]
        return pred, lower, upper


class _RandomForest:
    name = "RandomForest"

    def __init__(self):
        self.model_       = None
        self.features_    = None
        self.slope_       = 0.0
        self.intercept_   = 0.0
        self.sigma_       = 0.0
        self.n_train_     = 0

    def fit(self, y: pd.Series):
        from sklearn.ensemble import RandomForestRegressor
        df = _make_features(y)
        self.n_train_ = len(y)
        t = np.arange(self.n_train_)
        A = np.vstack([t, np.ones(self.n_train_)]).T
        self.slope_, self.intercept_ = np.linalg.lstsq(A, y.values, rcond=None)[0]
        self.features_ = [c for c in df.columns if c != "y"]
        X, yv = df[self.features_].values, df["y"].values
        self.model_ = RandomForestRegressor(n_estimators=100, random_state=42)
        self.model_.fit(X, yv)
        self.sigma_ = float(np.std(yv - self.model_.predict(X)))
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        df_f = _future_features(last_date, n, self.slope_, self.intercept_, self.n_train_)
        X = df_f[self.features_].values
        pred  = np.maximum(0, self.model_.predict(X))
        lower = np.maximum(0, pred - 1.96 * self.sigma_)
        upper = pred + 1.96 * self.sigma_
        return pred, lower, upper


class _XGBoost:
    name = "XGBoost"

    def __init__(self):
        self.model_     = None
        self.features_  = None
        self.slope_     = 0.0
        self.intercept_ = 0.0
        self.sigma_     = 0.0
        self.n_train_   = 0

    def fit(self, y: pd.Series):
        import xgboost as xgb
        df = _make_features(y)
        self.n_train_ = len(y)
        t = np.arange(self.n_train_)
        A = np.vstack([t, np.ones(self.n_train_)]).T
        self.slope_, self.intercept_ = np.linalg.lstsq(A, y.values, rcond=None)[0]
        self.features_ = [c for c in df.columns if c != "y"]
        X, yv = df[self.features_].values, df["y"].values
        self.model_ = xgb.XGBRegressor(n_estimators=200, max_depth=4,
                                        learning_rate=0.05, random_state=42,
                                        verbosity=0)
        self.model_.fit(X, yv)
        self.sigma_ = float(np.std(yv - self.model_.predict(X)))
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        df_f = _future_features(last_date, n, self.slope_, self.intercept_, self.n_train_)
        X = df_f[self.features_].values
        pred  = np.maximum(0, self.model_.predict(X))
        lower = np.maximum(0, pred - 1.96 * self.sigma_)
        upper = pred + 1.96 * self.sigma_
        return pred, lower, upper


class _LightGBM:
    name = "LightGBM"

    def __init__(self):
        self.model_     = None
        self.features_  = None
        self.slope_     = 0.0
        self.intercept_ = 0.0
        self.sigma_     = 0.0
        self.n_train_   = 0

    def fit(self, y: pd.Series):
        import lightgbm as lgb
        df = _make_features(y)
        self.n_train_ = len(y)
        t = np.arange(self.n_train_)
        A = np.vstack([t, np.ones(self.n_train_)]).T
        self.slope_, self.intercept_ = np.linalg.lstsq(A, y.values, rcond=None)[0]
        self.features_ = [c for c in df.columns if c != "y"]
        X, yv = df[self.features_].values, df["y"].values
        self.model_ = lgb.LGBMRegressor(n_estimators=200, num_leaves=15,
                                         learning_rate=0.05, random_state=42,
                                         verbose=-1)
        self.model_.fit(X, yv)
        self.sigma_ = float(np.std(yv - self.model_.predict(X)))
        return self

    def predict(self, n: int, last_date: pd.Timestamp):
        df_f = _future_features(last_date, n, self.slope_, self.intercept_, self.n_train_)
        X = df_f[self.features_].values
        pred  = np.maximum(0, self.model_.predict(X))
        lower = np.maximum(0, pred - 1.96 * self.sigma_)
        upper = pred + 1.96 * self.sigma_
        return pred, lower, upper


_ALL_MODEL_CLASSES = [_WeightedDOW, _HoltWinters, _SARIMA, _RandomForest, _XGBoost, _LightGBM]


def _available_models() -> List:
    """Devuelve clases de modelos disponibles (sin importar las opcionales que falten)."""
    available = [_WeightedDOW]
    checks = [
        ("statsmodels", [_HoltWinters, _SARIMA]),
        ("sklearn.ensemble", [_RandomForest]),
        ("xgboost", [_XGBoost]),
        ("lightgbm", [_LightGBM]),
    ]
    for mod_name, classes in checks:
        try:
            __import__(mod_name)
            available.extend(classes)
        except ImportError:
            pass
    return available


# ─── EVALUACIÓN ───────────────────────────────────────────────────────────────

def _metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    eps = 1e-9
    mae  = float(np.mean(np.abs(y_true - y_pred)))
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    mape = float(np.mean(np.abs((y_true - y_pred) / (y_true + eps))) * 100)
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2   = float(1 - ss_res / (ss_tot + eps))
    return {"mae": round(mae, 0), "rmse": round(rmse, 0),
            "mape": round(mape, 2), "r2": round(r2, 4)}


def _walk_forward(ModelClass, y: pd.Series, n_test: int = 14) -> Dict[str, float]:
    """Walk-forward: entrena hasta n-n_test, predice los últimos n_test días."""
    if len(y) < n_test + 21:
        return {"mae": 1e9, "rmse": 1e9, "mape": 1e9, "r2": -1.0}
    try:
        train = y.iloc[:-n_test]
        test  = y.iloc[-n_test:]
        m = ModelClass()
        m.fit(train)
        pred, _, _ = m.predict(n_test, train.index[-1])
        return _metrics(test.values, pred)
    except Exception:
        return {"mae": 1e9, "rmse": 1e9, "mape": 1e9, "r2": -1.0}


def _select_best_model(y: pd.Series) -> Tuple[Any, Dict[str, Dict]]:
    """Evalúa todos los modelos disponibles y devuelve el mejor por MAPE."""
    results = {}
    best_cls, best_mape = None, float("inf")
    for cls in _available_models():
        m = _walk_forward(cls, y)
        results[cls.name] = m
        if m["mape"] < best_mape:
            best_mape = m["mape"]
            best_cls  = cls
    return best_cls, results


# ─── ANÁLISIS ─────────────────────────────────────────────────────────────────

def _detect_outliers(y: pd.Series) -> List[Dict]:
    """Detecta días atípicos (|z| > 2.5) como eventos extraordinarios."""
    dow_means = y.groupby(y.index.dayofweek).transform("mean")
    dow_stds  = y.groupby(y.index.dayofweek).transform("std").fillna(1)
    z = (y - dow_means) / (dow_stds + 1)
    outliers = []
    for d, zv in z.items():
        if abs(zv) > 2.5:
            outliers.append({
                "fecha": d.strftime("%Y-%m-%d"),
                "revenue": round(float(y[d]), 0),
                "z_score": round(float(zv), 2),
                "tipo": "alto" if zv > 0 else "bajo",
            })
    return sorted(outliers, key=lambda x: abs(x["z_score"]), reverse=True)


def _trend_analysis(y: pd.Series) -> Dict:
    """Tendencia general y semanal. Domingo se trata como día cerrado."""
    t = np.arange(len(y))
    A = np.vstack([t, np.ones(len(t))]).T
    slope, intercept = np.linalg.lstsq(A, y.values, rcond=None)[0]

    # Semanal por DOW (0=Mon … 6=Sun en pandas)
    dow_avgs = y.groupby(y.index.dayofweek).mean()
    dow_pattern = {_DOW_ES[i]: round(float(v), 0) for i, v in dow_avgs.items()}

    # Domingo está habitualmente cerrado; excluirlo del ranking mejor/peor
    open_dow = dow_avgs.drop(index=_SUNDAY_DOW, errors="ignore")
    mejor_dia = _DOW_ES[int(open_dow.idxmax())] if not open_dow.empty else _DOW_ES[int(dow_avgs.idxmax())]
    peor_dia  = _DOW_ES[int(open_dow.idxmin())] if not open_dow.empty else _DOW_ES[int(dow_avgs.idxmin())]

    # Detección de domingos con apertura ocasional
    sun_mask    = y.index.dayofweek == _SUNDAY_DOW
    sun_series  = y[sun_mask]
    avg_open    = open_dow.mean() if not open_dow.empty else 1.0
    sun_open_threshold = avg_open * 0.15  # > 15 % del promedio = estuvo abierto
    domingos_abiertos = int((sun_series > sun_open_threshold).sum())

    # Mensual
    monthly = y.resample("ME").mean()
    monthly_vals = [{"mes": str(d)[:7], "avg": round(float(v), 0)}
                    for d, v in monthly.items()]

    # Primera mitad vs segunda mitad
    mid = len(y) // 2
    first_half  = y.iloc[:mid].mean()
    second_half = y.iloc[mid:].mean()
    growth_pct  = ((second_half - first_half) / (first_half + 1)) * 100

    return {
        "slope_diario":            round(float(slope), 0),
        "tendencia":               "positiva" if slope > 0 else "negativa",
        "crecimiento_periodo_pct": round(float(growth_pct), 1),
        "dow_pattern":             dow_pattern,
        "mejor_dia":               mejor_dia,
        "peor_dia":                peor_dia,
        "mensual":                 monthly_vals,
        "domingos_abiertos":       domingos_abiertos,
        "domingo_tipicamente_cerrado": True,
    }


def _product_trends(df_prod: pd.DataFrame, window_weeks: int = 8) -> Dict:
    """
    Clasifica productos correctamente según su ciclo de vida.

    Compara la tasa de venta (qty/día activo) entre dos ventanas recientes
    de `window_weeks` semanas cada una, solo para productos que tienen
    presencia suficiente en AMBAS ventanas.

    Clasifica por separado:
    - nuevos: entraron en la última ventana reciente (no existían antes)
    - retirados: no aparecen en la ventana reciente (salieron de carta)
    - subiendo / estable / bajando: comparación de tasas entre ventanas
    """
    end_date   = df_prod["fecha"].max()
    w = timedelta(weeks=window_weeks)

    # Ventana reciente: últimas window_weeks semanas
    recent_start = end_date - w
    # Ventana anterior: las window_weeks semanas antes de la reciente
    prev_start   = recent_start - w
    prev_end     = recent_start

    # Umbrales
    MIN_DAYS_PER_WINDOW = 3   # mínimo días activos en cada ventana para comparar
    MIN_QTY_TOTAL = 5         # mínimo unidades históricas para considerarlo

    # Stats globales por producto
    totals = df_prod.groupby("nombre").agg(
        qty_total    =("qty", "sum"),
        rev_total    =("revenue", "sum"),
        primera_venta=("fecha", "min"),
        ultima_venta =("fecha", "max"),
        dias_activo  =("fecha", "nunique"),
    ).reset_index()
    totals = totals[totals["qty_total"] >= MIN_QTY_TOTAL]

    # Ventas por ventana
    df_rec  = df_prod[df_prod["fecha"] >  recent_start]
    df_prev = df_prod[(df_prod["fecha"] >  prev_start) & (df_prod["fecha"] <= prev_end)]

    rec_qty  = df_rec.groupby("nombre")["qty"].sum()
    rec_days = df_rec.groupby("nombre")["fecha"].nunique()
    prev_qty  = df_prev.groupby("nombre")["qty"].sum()
    prev_days = df_prev.groupby("nombre")["fecha"].nunique()

    nuevos, retirados, activos = [], [], []

    for _, row in totals.iterrows():
        n = row["nombre"]
        primera = row["primera_venta"]
        ultima  = row["ultima_venta"]

        r_qty  = float(rec_qty.get(n, 0))
        r_days = int(rec_days.get(n, 0))
        p_qty  = float(prev_qty.get(n, 0))
        p_days = int(prev_days.get(n, 0))

        base = {
            "nombre":       n,
            "qty_total":    round(float(row["qty_total"]), 0),
            "rev_total":    round(float(row["rev_total"]), 0),
            "primera_venta": str(primera)[:10],
            "ultima_venta":  str(ultima)[:10],
            "dias_activo":  int(row["dias_activo"]),
            "qty_reciente": round(r_qty, 0),
        }

        # Producto nuevo: entró dentro de la ventana reciente y no estaba antes
        if primera > prev_end and r_days >= MIN_DAYS_PER_WINDOW:
            nuevos.append({**base, "cambio_pct": None, "tendencia": "nuevo"})
            continue

        # Producto retirado: última venta fue antes de la ventana reciente
        if ultima <= recent_start:
            retirados.append({**base, "cambio_pct": None, "tendencia": "retirado"})
            continue

        # Datos insuficientes en alguna ventana para comparar
        if r_days < MIN_DAYS_PER_WINDOW or p_days < MIN_DAYS_PER_WINDOW:
            continue

        # Tasa diaria en cada ventana (qty / días activos)
        rate_rec  = r_qty  / r_days
        rate_prev = p_qty  / p_days

        cambio_pct = ((rate_rec - rate_prev) / (rate_prev + 0.01)) * 100
        tendencia  = (
            "subiendo" if cambio_pct >  12 else
            "bajando"  if cambio_pct < -12 else
            "estable"
        )
        activos.append({**base,
                        "rate_reciente":  round(rate_rec, 2),
                        "rate_anterior":  round(rate_prev, 2),
                        "cambio_pct":     round(cambio_pct, 1),
                        "tendencia":      tendencia})

    # Ordenar
    activos.sort(key=lambda x: -(x["cambio_pct"] or 0))
    growing   = [t for t in activos if t["tendencia"] == "subiendo"][:10]
    declining = [t for t in reversed(activos) if t["tendencia"] == "bajando"][:10]
    nuevos.sort(key=lambda x: -x["qty_reciente"])
    retirados.sort(key=lambda x: -x["qty_total"])

    # Top global (últimas 8 semanas de presencia)
    top_rev = sorted(
        [t for t in activos] + [t for t in nuevos],
        key=lambda x: -x["rev_total"]
    )[:15]
    top_qty = sorted(
        [t for t in activos] + [t for t in nuevos],
        key=lambda x: -x["qty_total"]
    )[:15]

    return {
        "crecimiento":  growing,
        "caida":        declining,
        "nuevos":       nuevos[:8],
        "retirados":    retirados[:8],
        "top_revenue":  top_rev,
        "top_cantidad": top_qty,
        "ventana_semanas": window_weeks,
        "ventana_reciente_desde": str(recent_start)[:10],
        "ventana_anterior_desde": str(prev_start)[:10],
    }


def _generate_alerts(trend: Dict, products: Dict, outliers: List) -> List[Dict]:
    """Genera alertas y recomendaciones automáticas."""
    alerts = []

    if trend["tendencia"] == "positiva":
        alerts.append({
            "tipo": "positivo",
            "titulo": "Tendencia en crecimiento",
            "mensaje": f"Las ventas crecen ${trend['slope_diario']:,.0f}/día. "
                       f"Crecimiento del período: {trend['crecimiento_periodo_pct']}%.",
        })
    else:
        alerts.append({
            "tipo": "advertencia",
            "titulo": "Tendencia en baja",
            "mensaje": f"Las ventas bajan ${abs(trend['slope_diario']):,.0f}/día. "
                       f"Revisar estrategia de precios o promociones.",
        })

    peor = trend["peor_dia"]
    mejor = trend["mejor_dia"]
    dow_vals = trend["dow_pattern"]
    if dow_vals:
        alerts.append({
            "tipo": "info",
            "titulo": f"Mejor día: {mejor}",
            "mensaje": f"Los {mejor} facturan ${dow_vals.get(mejor, 0):,.0f} en promedio. "
                       f"Los {peor} son los más bajos (${dow_vals.get(peor, 0):,.0f}).",
        })

    # Domingo cerrado / abierto
    if trend.get("domingo_tipicamente_cerrado"):
        n_dom = trend.get("domingos_abiertos", 0)
        if n_dom > 0:
            alerts.append({
                "tipo": "info",
                "titulo": f"Domingos con apertura: {n_dom}",
                "mensaje": f"El local estuvo abierto {n_dom} domingo(s) en el período analizado. "
                           f"El modelo los considera como días de baja facturación.",
            })

    for p in products.get("crecimiento", [])[:3]:
        chg = p.get("cambio_pct") or 0
        alerts.append({
            "tipo": "positivo",
            "titulo": f"↑ {p['nombre']}",
            "mensaje": f"Tasa de venta subió {chg:.1f}% vs las 8 semanas anteriores. "
                       f"Considerar aumentar stock.",
        })

    for p in products.get("caida", [])[:3]:
        chg = p.get("cambio_pct") or 0
        alerts.append({
            "tipo": "advertencia",
            "titulo": f"↓ {p['nombre']}",
            "mensaje": f"Tasa de venta bajó {abs(chg):.1f}% vs las 8 semanas anteriores.",
        })

    if outliers:
        o = outliers[0]
        tipo = "ventas extraordinarias" if o["tipo"] == "alto" else "caída anómala"
        alerts.append({
            "tipo": "info",
            "titulo": f"Evento atípico: {o['fecha']}",
            "mensaje": f"El {o['fecha']} hubo {tipo} (${o['revenue']:,.0f}). "
                       f"Puede distorsionar el modelo.",
        })

    return alerts


# ─── PREDICCIÓN PRINCIPAL ─────────────────────────────────────────────────────

_HORIZON_DAYS = {
    "day":    1,
    "week":   7,
    "month":  30,
    "quarter":91,
    "year":  365,
}


def predict(
    location_key: str = "recoleta",
    horizon: str = "week",
    segment: str = "total",
    product: Optional[str] = None,
    force_model: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Genera predicción completa para el horizonte y segmento pedidos.

    segment: "total" | "product"
    horizon: "day" | "week" | "month" | "quarter" | "year"
    """
    import time as _time

    cache_key = f"{location_key}:{horizon}:{segment}:{product}:{force_model}"
    cached = _CACHE.get(cache_key)
    if cached and (_time.time() - cached[0]) < _CACHE_TTL:
        return cached[1]

    n_days = _HORIZON_DAYS.get(horizon, 7)

    # Usa TODO el historial disponible (6+ años) para entrenamiento y gráfico
    df_daily_full = _load_daily(location_key)
    df_prod = _load_products(location_key)

    # Seleccionar serie a predecir
    if segment == "product" and product:
        prod_daily_full = (df_prod[df_prod["nombre"] == product]
                           .set_index("fecha")["qty"]
                           .resample("D").sum()
                           .reindex(df_daily_full.index, fill_value=0))
        y_full = prod_daily_full.astype(float)
        y = y_full
        metric_label = "Unidades"
    else:
        y_full = df_daily_full["revenue"].astype(float)
        y = y_full
        metric_label = "Facturación"

    # Selección de modelo
    if force_model:
        cls_map = {c.name: c for c in _ALL_MODEL_CLASSES}
        best_cls = cls_map.get(force_model, _WeightedDOW)
        all_metrics = {best_cls.name: _walk_forward(best_cls, y)}
    else:
        best_cls, all_metrics = _select_best_model(y)

    # Ajuste final con todos los datos
    model = best_cls()
    model.fit(y)
    pred, lower, upper = model.predict(n_days, y.index[-1])

    # Fechas futuras
    future_dates = [
        (y.index[-1] + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        for i in range(n_days)
    ]

    # Análisis
    trend    = _trend_analysis(y)
    outliers = _detect_outliers(y)
    products = _product_trends(df_prod)
    alerts   = _generate_alerts(trend, products, outliers)

    # KPIs del histórico reciente (últimas 4 semanas)
    recent = df_daily_full.iloc[-28:]
    pedidos_recent = recent["pedidos"].mean()
    ticket_avg = (recent["revenue"] / (recent["pedidos"] + 0.01)).replace([np.inf, -np.inf], 0).mean()

    total_proyectado = float(pred.sum())
    # Comparar con mismo período anterior
    prev_start = max(0, len(y) - 2 * n_days)
    prev_period = y.iloc[prev_start:prev_start + n_days]
    crecimiento_vs_anterior = (
        (total_proyectado - float(prev_period.sum())) / (float(prev_period.sum()) + 1)
    ) * 100 if len(prev_period) == n_days else 0.0

    result = {
        "meta": {
            "segment": segment,
            "product": product,
            "horizon": horizon,
            "n_days": n_days,
            "metric_label": metric_label,
            "modelo_usado": best_cls.name,
            "generado_en": datetime.now().isoformat(),
            "datos_desde": str(y_full.index[0])[:10],
            "datos_hasta": str(y_full.index[-1])[:10],
            "dias_historico_total": len(y_full),
        },
        "historico": [
            {
                "fecha": str(d)[:10],
                "valor": round(float(v), 0),
                "pedidos": round(float(df_daily_full.loc[d, "pedidos"]) if d in df_daily_full.index else 0, 0),
            }
            for d, v in y_full.items()
        ],
        "prediccion": [
            {
                "fecha": future_dates[i],
                "valor": round(float(pred[i]), 0),
                "lower": round(float(lower[i]), 0),
                "upper": round(float(upper[i]), 0),
            }
            for i in range(n_days)
        ],
        "kpis": {
            "total_proyectado": round(total_proyectado, 0),
            "promedio_diario": round(total_proyectado / max(n_days, 1), 0),
            "crecimiento_vs_anterior_pct": round(crecimiento_vs_anterior, 1),
            "ticket_promedio": round(float(ticket_avg), 0),
            "pedidos_diarios_esperados": round(float(pedidos_recent), 0),
        },
        "modelos": [
            {
                "nombre": name,
                "mae": round(m["mae"], 0),
                "rmse": round(m["rmse"], 0),
                "mape": round(m["mape"], 2),
                "r2": round(m["r2"], 4),
                "seleccionado": (name == best_cls.name),
            }
            for name, m in all_metrics.items()
        ],
        "tendencia": trend,
        "outliers": outliers[:5],
        "productos": products,
        "alertas": alerts,
    }

    _CACHE[cache_key] = (_time.time(), result)
    return result


def invalidate_cache():
    _CACHE.clear()


def get_data_range(location_key: str = "recoleta") -> Dict[str, Any]:
    """Rango de datos disponibles y resumen rápido."""
    df = _load_daily(location_key)
    if df.empty:
        return {"disponible": False}
    nonzero = df[df["revenue"] > 0]
    return {
        "disponible": True,
        "desde": str(nonzero.index[0])[:10] if not nonzero.empty else None,
        "hasta": str(nonzero.index[-1])[:10] if not nonzero.empty else None,
        "dias_con_datos": int((nonzero["revenue"] > 0).sum()),
        "revenue_total": round(float(nonzero["revenue"].sum()), 0),
        "revenue_diario_avg": round(float(nonzero["revenue"].mean()), 0),
    }


def get_productos_lista(location_key: str = "recoleta") -> List[Dict[str, Any]]:
    """Lista completa de productos ordenados por facturación total histórica."""
    df = _load_products(location_key)
    ranking = (
        df.groupby("nombre")
        .agg(qty_total=("qty", "sum"), rev_total=("revenue", "sum"))
        .sort_values("rev_total", ascending=False)
        .reset_index()
    )
    return [
        {
            "nombre": row["nombre"],
            "qty_total": round(float(row["qty_total"]), 1),
            "rev_total": round(float(row["rev_total"]), 0),
        }
        for _, row in ranking.iterrows()
    ]


def get_producto_evolucion(
    nombre: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    location_key: str = "recoleta",
) -> Dict[str, Any]:
    """Evolución diaria de unidades vendidas para un producto + insights automáticos."""
    df_all = _load_products(location_key)

    # Ranking global (toda la historia)
    ranking = (
        df_all.groupby("nombre")["qty"]
        .sum()
        .sort_values(ascending=False)
        .reset_index()
    )
    ranking["rank"] = range(1, len(ranking) + 1)
    total_prods = len(ranking)
    row_rank = ranking[ranking["nombre"] == nombre]
    rank_pos = int(row_rank["rank"].iloc[0]) if not row_rank.empty else None
    qty_total_alltime = float(row_rank["qty"].iloc[0]) if not row_rank.empty else 0.0

    # Filtrar por producto
    prod = df_all[df_all["nombre"] == nombre].copy()
    if prod.empty:
        return {"error": "Producto no encontrado", "series": [], "insights": {}}

    prod = prod.sort_values("fecha").set_index("fecha")

    # Aplicar filtros de fecha
    if start_date:
        prod = prod[prod.index >= pd.Timestamp(start_date)]
    if end_date:
        prod = prod[prod.index <= pd.Timestamp(end_date)]

    if prod.empty:
        return {"error": "Sin datos en el rango seleccionado", "series": [], "insights": {}}

    # Rellenar días faltantes con 0
    full_idx = pd.date_range(prod.index.min(), prod.index.max(), freq="D")
    prod = prod[~prod.index.duplicated(keep="first")].reindex(full_idx, fill_value=0)

    qty = prod["qty"].astype(float)
    rev = prod["revenue"].astype(float)
    n = len(qty)

    # ── Insight 1: Tendencia por regresión lineal ─────────────────────
    if n >= 7:
        x = np.arange(n, dtype=float)
        mask = qty.values > 0
        if mask.sum() >= 3:
            slope, _ = np.polyfit(x[mask], qty.values[mask], 1)
        else:
            slope = 0.0
        mean_qty = float(qty[qty > 0].mean()) if (qty > 0).any() else 1.0
        slope_pct = (slope * n / mean_qty * 100) if mean_qty > 0 else 0.0
        if slope_pct > 8:
            tendencia_label = "subiendo"
        elif slope_pct < -8:
            tendencia_label = "bajando"
        else:
            tendencia_label = "estable"
    else:
        slope_pct = 0.0
        tendencia_label = "sin_datos"

    # ── Insight 2: Cambio primera vs segunda mitad del período ────────
    half = n // 2
    if half >= 7:
        recent_avg = float(qty.iloc[half:].mean())
        prev_avg   = float(qty.iloc[:half].mean())
        cambio_pct: Optional[float] = ((recent_avg - prev_avg) / prev_avg * 100) if prev_avg > 0 else 0.0
    else:
        cambio_pct = None

    # ── Estadísticas del período ──────────────────────────────────────
    active_days = int((qty > 0).sum())
    avg_active  = float(qty[qty > 0].mean()) if active_days > 0 else 0.0
    qty_periodo = float(qty.sum())
    rev_periodo = float(rev.sum())

    # Mejor mes del período
    monthly    = qty.resample("ME").sum()
    best_month = str(monthly.idxmax())[:7] if not monthly.empty and monthly.max() > 0 else None

    series = [
        {"fecha": str(d.date()), "qty": round(float(q), 1), "revenue": round(float(r), 0)}
        for d, q, r in zip(prod.index, qty, rev)
    ]

    return {
        "nombre": nombre,
        "series": series,
        "insights": {
            "tendencia": tendencia_label,
            "slope_pct_periodo": round(float(slope_pct), 1),
            "cambio_pct": round(float(cambio_pct), 1) if cambio_pct is not None else None,
            "ranking_pos": rank_pos,
            "total_productos": total_prods,
            "qty_total_alltime": round(qty_total_alltime, 0),
            "qty_periodo": round(qty_periodo, 1),
            "rev_periodo": round(rev_periodo, 0),
            "active_days": active_days,
            "avg_active": round(avg_active, 1),
            "mejor_mes": best_month,
        },
    }
