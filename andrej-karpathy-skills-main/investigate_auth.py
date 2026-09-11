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
    # users table schema
    'sqlite3 /home/tiago/recetario-nucleo/backend/src/services/nucleocheck.db ".schema users"',
    # auth controller
    'cat /home/tiago/recetario-nucleo/backend/src/controllers/auth_controller.py',
    # middleware auth - how roles are checked
    'cat /home/tiago/recetario-nucleo/backend/src/middleware/auth.py',
    # where users are created / what roles exist
    'grep -rn "admin\\|normal\\|visor\\|role\\|Role" /home/tiago/recetario-nucleo/backend/src/controllers/auth_controller.py 2>/dev/null | head -20',
]

for cmd in cmds:
    _, out, _ = client.exec_command(cmd)
    result = out.read().decode('utf-8', errors='replace').strip()
    safe = result.encode('ascii', errors='replace').decode('ascii')
    print(f"\n{'='*60}\n>>> {cmd[:80]}\n{'='*60}")
    print(safe[:3000] if safe else "(vacio)")

client.close()
