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
    # full shift constants section
    'sed -n "90,200p" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py',
    # _fetch_cobrado function full
    'sed -n "141,175p" /home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py',
    # find scraper.py location
    'find /home/tiago/recetario-nucleo -name "scraper.py" 2>/dev/null',
    # check scraper for shift hours
    'grep -n "NOCHE\\|MANANA\\|turno\\|shift_start\\|shift_end\\|20:\\|19:\\|21:" /home/tiago/recetario-nucleo/backend/src/services/scraper.py 2>/dev/null | head -20',
    # check users table to understand roles
    'sqlite3 /home/tiago/recetario-nucleo/backend/src/services/nucleocheck.db "SELECT id, username, role FROM users LIMIT 20;"',
]

for cmd in cmds:
    _, out, _ = client.exec_command(cmd)
    result = out.read().decode('utf-8', errors='replace').strip()
    safe = result.encode('ascii', errors='replace').decode('ascii')
    print(f"\n{'='*60}\n>>> {cmd[:80]}\n{'='*60}")
    print(safe[:3000] if safe else "(vacio)")

client.close()
