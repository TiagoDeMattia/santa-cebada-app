#!/usr/bin/env python3
"""Agrega endpoint GET /stock-general/pedidos/ultimo al backend."""
import paramiko

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

SVC_PATH  = "/home/tiago/recetario-nucleo/backend/src/services/stock_general_service.py"
CTRL_PATH = "/home/tiago/recetario-nucleo/backend/src/controllers/stock_general_controller.py"

# ── 1. Leer archivos actuales ─────────────────────────────────────────────────
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)

sftp = client.open_sftp()

with sftp.open(SVC_PATH, "r") as f:
    svc = f.read().decode()

with sftp.open(CTRL_PATH, "r") as f:
    ctrl = f.read().decode()

# ── 2. Agregar función al service (antes de # ── Proveedores) ─────────────────
NEW_SVC_FUNC = '''
def get_pedidos_ultimo() -> dict:
    """Devuelve los pedidos de la última fecha con datos cargados."""
    ensure_schema()
    with get_engine().connect() as conn:
        row = conn.execute(text(
            "SELECT MAX(fecha) AS ultima FROM sg_registros WHERE pedido > 0"
        )).fetchone()
    if not row or not row.ultima:
        return {"fecha": None, "pedidos": []}
    return {"fecha": row.ultima, "pedidos": get_pedidos_del_dia(row.ultima)}

'''

ANCHOR_SVC = "# ── Proveedores ─"
if "get_pedidos_ultimo" not in svc:
    idx = svc.find(ANCHOR_SVC)
    if idx == -1:
        print("ERROR: no encontré el ancla en el service")
    else:
        svc = svc[:idx] + NEW_SVC_FUNC + svc[idx:]
        with sftp.open(SVC_PATH, "w") as f:
            f.write(svc)
        print("Service actualizado OK")
else:
    print("Service: función ya existe, skipping")

# ── 3. Agregar ruta al controller (antes de @router.get("/pedidos")) ──────────
NEW_CTRL_ROUTE = '''@router.get("/pedidos/ultimo")
def get_pedidos_ultimo():
    return svc.get_pedidos_ultimo()

'''

ANCHOR_CTRL = '@router.get("/pedidos")'
if '"/pedidos/ultimo"' not in ctrl:
    idx = ctrl.find(ANCHOR_CTRL)
    if idx == -1:
        print("ERROR: no encontré el ancla en el controller")
    else:
        ctrl = ctrl[:idx] + NEW_CTRL_ROUTE + ctrl[idx:]
        with sftp.open(CTRL_PATH, "w") as f:
            f.write(ctrl)
        print("Controller actualizado OK")
else:
    print("Controller: ruta ya existe, skipping")

sftp.close()

# ── 4. Reiniciar backend ──────────────────────────────────────────────────────
_, out, err = client.exec_command("pm2 restart backend-nucleo --silent && sleep 2 && curl -s http://localhost:8001/health")
print("Restart:", out.read().decode())
e = err.read().decode()
if e: print("ERR:", e)

client.close()
