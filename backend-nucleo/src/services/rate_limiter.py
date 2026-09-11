"""
Rate limiter y retry logic para Google Sheets API.
Evita exceder la cuota de 60 lecturas por minuto.
"""
import time
from functools import wraps
from typing import Callable, Any
from ..utils.logger import logger

# Contador de requests por minuto
_request_count = 0
_last_reset_time = time.time()
_max_requests_per_minute = 55  # Dejamos margen de seguridad (límite real: 60)

def reset_counter_if_needed():
    """Resetea el contador si ha pasado 1 minuto."""
    global _request_count, _last_reset_time
    current_time = time.time()
    if current_time - _last_reset_time >= 60:
        _request_count = 0
        _last_reset_time = current_time
        logger.info("Rate limiter: Contador reseteado")

def wait_if_needed():
    """Espera si estamos cerca del límite."""
    global _request_count
    reset_counter_if_needed()
    
    if _request_count >= _max_requests_per_minute:
        wait_time = 60 - (time.time() - _last_reset_time)
        if wait_time > 0:
            logger.warning(f"Rate limiter: Esperando {wait_time:.1f}s para evitar exceder cuota")
            time.sleep(wait_time)
            reset_counter_if_needed()

def rate_limited(func: Callable) -> Callable:
    """
    Decorator para funciones que hacen requests a Google Sheets API.
    Controla el rate limit y hace retry con backoff exponencial.
    """
    @wraps(func)
    def wrapper(*args, **kwargs) -> Any:
        global _request_count
        
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                # Esperar si estamos cerca del límite
                wait_if_needed()
                
                # Incrementar contador
                _request_count += 1
                
                # Ejecutar función
                result = func(*args, **kwargs)
                return result
                
            except Exception as e:
                error_str = str(e)
                
                # Si es error 429 (rate limit exceeded)
                if "429" in error_str or "RATE_LIMIT_EXCEEDED" in error_str:
                    if attempt < max_retries - 1:
                        # Calcular delay con backoff exponencial
                        delay = base_delay * (2 ** attempt)
                        logger.warning(f"Rate limit excedido. Reintentando en {delay}s (intento {attempt + 1}/{max_retries})")
                        time.sleep(delay)
                        
                        # Resetear contador para forzar espera
                        _request_count = _max_requests_per_minute
                        continue
                    else:
                        logger.error(f"Rate limit excedido después de {max_retries} intentos")
                        raise
                else:
                    # Otro tipo de error, no reintentar
                    raise
        
        return None
    
    return wrapper
