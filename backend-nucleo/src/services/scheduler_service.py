"""
Servicio para tareas programadas (scheduled tasks).

IMPORTANTE: Los snapshots de stocks se capturan automáticamente los LUNES a las 9 AM (horario Argentina - UTC-3).
Las ventas del recetario se procesan automáticamente cada 2 horas.
"""
import asyncio
from datetime import datetime, time, timedelta
from typing import Optional
import pytz

from ..services import historial_service
from ..utils.logger import logger


# Zona horaria de Argentina
ARGENTINA_TZ = pytz.timezone('America/Argentina/Buenos_Aires')

# Configuración de captura de snapshots de historial
SNAPSHOT_DAY = 0  # 0 = Lunes, 1 = Martes, etc.
SNAPSHOT_HOUR = 9  # 9 AM
SNAPSHOT_MINUTE = 0

# Configuración de procesamiento de ventas del recetario
VENTAS_INTERVALO_HORAS = 2  # Cada 2 horas


class SchedulerService:
    """
    Servicio para gestionar tareas programadas.
    """
    
    def __init__(self):
        self.running = False
        self.task: Optional[asyncio.Task] = None
        self.task_ventas: Optional[asyncio.Task] = None
        self.task_metas: Optional[asyncio.Task] = None
    
    async def start(self):
        """Inicia el scheduler."""
        if self.running:
            logger.warning("Scheduler ya está corriendo")
            return

        self.running = True
        self.task = asyncio.create_task(self._run())
        self.task_ventas = asyncio.create_task(self._run_ventas())
        self.task_metas = asyncio.create_task(self._run_metas())
        logger.info("✓ Scheduler iniciado - Snapshots programados para LUNES a las 9 AM (Argentina)")
        logger.info(f"✓ Procesamiento de ventas programado cada {VENTAS_INTERVALO_HORAS} horas")
        logger.info("✓ Trackeo de metas de venta programado para las 00:00 (Argentina)")
    
    async def stop(self):
        """Detiene el scheduler."""
        if not self.running:
            return
        
        self.running = False
        
        for task in [self.task, self.task_ventas, self.task_metas]:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        logger.info("Scheduler detenido")
    
    async def _run(self):
        """Loop principal del scheduler (snapshots de historial)."""
        while self.running:
            try:
                next_run = self._get_next_run_time()
                now = datetime.now(ARGENTINA_TZ)
                
                wait_seconds = (next_run - now).total_seconds()
                
                if wait_seconds > 0:
                    logger.info(f"Próximo snapshot programado para: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
                    logger.info(f"Esperando {wait_seconds / 3600:.1f} horas...")
                    await asyncio.sleep(wait_seconds)
                
                if self.running:
                    await self._capture_snapshots()
                
                await asyncio.sleep(60)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error en scheduler: {str(e)}", exc_info=True)
                await asyncio.sleep(300)
    
    async def _run_ventas(self):
        """Loop de procesamiento automático de ventas del recetario."""
        # Esperar 1 minuto antes de la primera ejecución para que el servidor arranque
        await asyncio.sleep(60)
        
        while self.running:
            try:
                logger.info(f"[Recetario] Iniciando procesamiento automático de ventas...")
                await self._procesar_ventas_recetario()
                
                logger.info(f"[Recetario] Próximo procesamiento en {VENTAS_INTERVALO_HORAS} horas")
                await asyncio.sleep(VENTAS_INTERVALO_HORAS * 3600)
            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Recetario] Error en procesamiento automático: {str(e)}", exc_info=True)
                # Reintentar en 10 minutos si hay error
                await asyncio.sleep(600)
    
    def _get_next_run_time(self) -> datetime:
        """
        Calcula la próxima fecha/hora de ejecución (próximo lunes a las 9 AM).
        """
        now = datetime.now(ARGENTINA_TZ)
        
        today_run = now.replace(
            hour=SNAPSHOT_HOUR,
            minute=SNAPSHOT_MINUTE,
            second=0,
            microsecond=0
        )
        
        if now >= today_run or now.weekday() != SNAPSHOT_DAY:
            days_ahead = SNAPSHOT_DAY - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_run = today_run + timedelta(days=days_ahead)
        else:
            next_run = today_run
        
        return next_run
    
    async def _capture_snapshots(self):
        """Captura snapshots de todas las sucursales."""
        try:
            logger.info("=" * 80)
            logger.info("INICIANDO CAPTURA AUTOMÁTICA DE SNAPSHOTS")
            logger.info(f"Fecha/Hora: {datetime.now(ARGENTINA_TZ).strftime('%Y-%m-%d %H:%M:%S %Z')}")
            logger.info("=" * 80)
            
            result = await asyncio.to_thread(historial_service.capturar_todas_las_sucursales)
            
            logger.info("✓ Snapshots capturados exitosamente:")
            logger.info(f"  - Recoleta Cocina: {result['recoleta']['cocina']['total_productos']} productos")
            logger.info(f"  - Recoleta Salón: {result['recoleta']['salon']['total_productos']} productos")
            logger.info("=" * 80)
        
        except Exception as e:
            logger.error(f"Error capturando snapshots automáticos: {str(e)}", exc_info=True)
    
    async def _procesar_ventas_recetario(self):
        """Procesa ventas del recetario."""
        try:
            from ..services.recetario_service import RecetarioService
            recetario_service = RecetarioService()

            for sucursal in ["recoleta"]:
                try:
                    resultado = await asyncio.to_thread(recetario_service.procesar_ventas, sucursal)

                    if resultado.get("success"):
                        logger.info(
                            f"[Recetario] {sucursal.capitalize()}: "
                            f"{resultado['ventas_procesadas']} ventas procesadas, "
                            f"{resultado['productos_actualizados']} productos actualizados"
                        )
                    else:
                        # Si no hay snapshot, no es un error crítico
                        logger.info(f"[Recetario] {sucursal.capitalize()}: {resultado.get('error', 'Sin datos')}")
                
                except Exception as e:
                    logger.error(f"[Recetario] Error procesando {sucursal}: {str(e)}")
        
        except Exception as e:
            logger.error(f"[Recetario] Error general en procesamiento: {str(e)}", exc_info=True)
    
    async def _run_metas(self):
        """Loop de trackeo automático de metas de venta (cada 3 horas)."""
        await asyncio.sleep(30)  # dar tiempo al servidor a iniciar

        while self.running:
            try:
                logger.info("[Metas] Iniciando trackeo automático de metas de venta nucleo...")
                from ..services import metas_venta_service
                result = await asyncio.to_thread(metas_venta_service.trackear_todas_nucleo)
                logger.info(f"[Metas] Trackeo completado: {result['actualizadas']} metas actualizadas")
                await asyncio.sleep(3 * 3600)  # cada 3 horas

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[Metas] Error en trackeo automático: {e}", exc_info=True)
                await asyncio.sleep(300)

    async def capture_now(self):
        """Captura snapshots inmediatamente."""
        logger.info("Captura manual de snapshots solicitada")
        await self._capture_snapshots()
    
    async def procesar_ventas_now(self):
        """Procesa ventas inmediatamente."""
        logger.info("Procesamiento manual de ventas solicitado")
        await self._procesar_ventas_recetario()


# Instancia global del scheduler
scheduler = SchedulerService()


async def start_scheduler():
    """Inicia el scheduler (llamar desde el startup de la app)."""
    await scheduler.start()


async def stop_scheduler():
    """Detiene el scheduler (llamar desde el shutdown de la app)."""
    await scheduler.stop()


async def capture_snapshots_now():
    """Captura snapshots inmediatamente."""
    await scheduler.capture_now()


async def procesar_ventas_recetario_now():
    """Procesa ventas del recetario inmediatamente."""
    await scheduler.procesar_ventas_now()
