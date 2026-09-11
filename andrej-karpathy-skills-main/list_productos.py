#!/usr/bin/env python3
import paramiko

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

REMOTE = (
    "import sqlite3\n"
    "db = sqlite3.connect('/home/tiago/recetario-nucleo/backend/src/services/nucleocheck.db')\n"
    "db.row_factory = sqlite3.Row\n"
    "c = db.cursor()\n"
    "rows = c.execute('SELECT codigo, nombre, rubro_id FROM sg_productos ORDER BY CAST(codigo AS INTEGER)').fetchall()\n"
    "for r in rows:\n"
    "    print(f\"{r['codigo']:>4} | {r['nombre']:<45} | rubro {r['rubro_id']}\")\n"
    "print(f'Total: {len(rows)}')\n"
    "db.close()\n"
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)
sftp = client.open_sftp()
with sftp.open("/tmp/list_prod.py", "w") as f:
    f.write(REMOTE)
sftp.close()
_, out, err = client.exec_command("python3 /tmp/list_prod.py")
print(out.read().decode())
e = err.read().decode()
if e:
    print("ERR:", e)
client.close()
