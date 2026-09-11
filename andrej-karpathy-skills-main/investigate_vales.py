#!/usr/bin/env python3
import paramiko, json

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)

cmds = [
    # check shift hours in config or estadistica service
    'grep -rn "turno\\|noche\\|manana\\|20:\\|21:\\|horario\\|shift" /home/tiago/recetario-nucleo/backend/src/config.py 2>/dev/null | head -20',
    'grep -rn "turno\\|noche\\|manana\\|20:\\|21:\\|horario" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py 2>/dev/null | head -30',
    # check the vales endpoint to see what it does
    'grep -rn "vales\\|Vales\\|Vale" /home/tiago/recetario-nucleo/backend/src/controllers/estadistica_controller.py 2>/dev/null | head -20',
    'grep -rn "def.*vales\\|vales" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py 2>/dev/null | head -20',
    # check known Nucleo API endpoints
    'grep -rn "FindPaged\\|/Order\\|/Sale\\|payment\\|forma_pago\\|PaymentMethod" /home/tiago/recetario-nucleo/backend/src/services/ 2>/dev/null | head -30',
    # check what endpoints are known
    'grep -rn "api_base\\|get\\|post" /home/tiago/recetario-nucleo/backend/src/services/nucleo_service.py 2>/dev/null | head -30',
]

for cmd in cmds:
    _, out, _ = client.exec_command(cmd)
    result = out.read().decode('utf-8', errors='replace').strip()
    safe = result.encode('ascii', errors='replace').decode('ascii')
    print(f"\n{'='*60}\n>>> {cmd[:80]}\n{'='*60}")
    print(safe[:2000] if safe else "(vacio)")

client.close()
