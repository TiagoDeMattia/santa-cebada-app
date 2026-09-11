#!/usr/bin/env python3
import paramiko, os

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"
BASE     = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)
sftp = client.open_sftp()

files = [
    ("/home/tiago/recetario-nucleo/backend/src/services/estadistica_service.py",
     rf"{BASE}\backend-nucleo\src\services\estadistica_service_remote.py"),
    ("/home/tiago/recetario-nucleo/backend/src/controllers/estadistica_controller.py",
     rf"{BASE}\backend-nucleo\src\controllers\estadistica_controller_remote.py"),
    ("/home/tiago/recetario-nucleo/backend/src/controllers/auth_controller.py",
     rf"{BASE}\backend-nucleo\src\controllers\auth_controller_remote.py"),
]

for remote, local in files:
    sftp.get(remote, local)
    print(f"Downloaded: {os.path.basename(local)}")

sftp.close()
client.close()
print("Done.")
