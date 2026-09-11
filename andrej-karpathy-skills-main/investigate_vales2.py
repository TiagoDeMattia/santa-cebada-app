#!/usr/bin/env python3
import paramiko

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)

cmds = [
    # shift hours constants at top of estadistica_service
    'head -110 /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py',
    # get_vales_counters function
    'sed -n "609,700p" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py',
    # _fetch_cobrado - how orders are fetched
    'grep -n "_fetch_cobrado\\|def _fetch" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py',
    'grep -n "Stats/Get\\|Order\\|formas_pago\\|payment_method\\|PaymentMethod\\|forma_pago" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py | head -30',
    # check helpers/data_processing for forma_pago mapping
    'grep -n "map_payment_category\\|vales\\|Vales\\|VALE" /home/tiago/recetario-nucleo/backend/src/services/data_processing.py | head -20',
    'grep -n "map_payment_category" /home/tiago/recetario-nucleo/backend/src/utils/helpers.py 2>/dev/null | head -5',
    'grep -n "vales\\|Vales\\|VALE\\|Vale" /home/tiago/recetario-nucleo/backend/src/utils/helpers.py 2>/dev/null | head -20',
]

for cmd in cmds:
    _, out, _ = client.exec_command(cmd)
    result = out.read().decode('utf-8', errors='replace').strip()
    safe = result.encode('ascii', errors='replace').decode('ascii')
    print(f"\n{'='*60}\n>>> {cmd[:80]}\n{'='*60}")
    print(safe[:3000] if safe else "(vacio)")

client.close()
