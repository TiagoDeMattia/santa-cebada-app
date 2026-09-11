"""
Enrutadores principales
"""
from fastapi import APIRouter
from ..controllers import auth_controller, producto_controller, sucursal_controller
from ..controllers import estadistica_controller
from ..controllers import barriles_controller
from ..controllers import audit_controller
from ..controllers import widget_controller
from ..controllers import stock_general_controller
from ..controllers import alertas_controller
from ..controllers import carta_ia_controller
from ..controllers import barriles_v2_controller
from ..controllers import metas_venta_controller
from ..controllers import app_config_controller
from ..controllers import voucher_controller
from ..controllers import tickets_controller
from ..routes import estadisticas_pedidos, cerveza_stock, prediccion
from ..routes import historial, stocks, recetario, estadisticas_stocks

api_router = APIRouter()

api_router.include_router(auth_controller.router)
api_router.include_router(producto_controller.router)
api_router.include_router(sucursal_controller.router)
api_router.include_router(estadistica_controller.router)
api_router.include_router(barriles_controller.router)
api_router.include_router(barriles_v2_controller.router)
api_router.include_router(audit_controller.router)
api_router.include_router(estadisticas_pedidos.router)
api_router.include_router(cerveza_stock.router)
api_router.include_router(prediccion.router)
api_router.include_router(widget_controller.router)
api_router.include_router(stock_general_controller.router)
api_router.include_router(alertas_controller.router)
api_router.include_router(carta_ia_controller.router)
api_router.include_router(metas_venta_controller.router)
api_router.include_router(app_config_controller.router)
api_router.include_router(voucher_controller.router)
api_router.include_router(tickets_controller.router)
api_router.include_router(historial.router)
api_router.include_router(stocks.router)
api_router.include_router(recetario.router)
api_router.include_router(estadisticas_stocks.router)
