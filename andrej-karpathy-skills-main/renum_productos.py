#!/usr/bin/env python3
import paramiko

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

REMOTE = r"""
import sqlite3
db = sqlite3.connect("/home/tiago/recetario-nucleo/backend/src/services/nucleocheck.db")
c = db.cursor()

rows = c.execute("SELECT id, codigo FROM sg_productos ORDER BY codigo").fetchall()
print(f"Total productos: {len(rows)}")

# Paso 1: codigos temporales para evitar conflicto de UNIQUE
for i, (pid, _) in enumerate(rows, start=1):
    c.execute("UPDATE sg_productos SET codigo = ? WHERE id = ?", (f"_tmp_{i}", pid))
db.commit()

# Paso 2: codigos finales
for i, (pid, old) in enumerate(rows, start=1):
    c.execute("UPDATE sg_productos SET codigo = ? WHERE id = ?", (str(i), pid))
    print(f"  {old} -> {i}")
db.commit()
db.close()
print("DONE")
"""

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)

sftp = client.open_sftp()
with sftp.open("/tmp/renum.py", "w") as f:
    f.write(REMOTE)
sftp.close()

_, out, err = client.exec_command("python3 /tmp/renum.py")
print(out.read().decode())
e = err.read().decode()
if e:
    print("ERR:", e)
client.close()
