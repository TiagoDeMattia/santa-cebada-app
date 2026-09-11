#!/usr/bin/env python3
import paramiko

SSH_HOST = "89.167.100.235"
SSH_PORT = 2222
SSH_USER = "tiago"
SSH_KEY  = r"C:\Users\Tiago\OneDrive\Escritorio\PROYECTO PAGINA FINAL\Credenciales VPS\tiago_vps_1_ed25519"

REMOTE = (
    "import sqlite3\n"
    "db = sqlite3.connect('/home/tiago/recetario-nucleo/backend/src/services/nucleocheck.db')\n"
    "c = db.cursor()\n"
    "\n"
    "# Eliminar duplicados: mantener el de id menor, borrar el resto\n"
    "sql_dups = (\n"
    "    'SELECT MIN(id) as keep_id, GROUP_CONCAT(id) as all_ids '\n"
    "    'FROM sg_productos '\n"
    "    'GROUP BY LOWER(TRIM(nombre)) '\n"
    "    'HAVING COUNT(*) > 1'\n"
    ")\n"
    "dups = c.execute(sql_dups).fetchall()\n"
    "deleted = 0\n"
    "for keep_id, all_ids in dups:\n"
    "    ids = [int(x) for x in all_ids.split(',')]\n"
    "    to_delete = [x for x in ids if x != keep_id]\n"
    "    for d in to_delete:\n"
    "        nm = c.execute('SELECT nombre, codigo FROM sg_productos WHERE id=?', (d,)).fetchone()\n"
    "        print(f'  Eliminando: {nm[1]} - {nm[0]} (mantengo id={keep_id})')\n"
    "        c.execute('DELETE FROM sg_productos WHERE id=?', (d,))\n"
    "        deleted += 1\n"
    "db.commit()\n"
    "print(f'Eliminados: {deleted} productos duplicados')\n"
    "\n"
    "# Renumerar sin huecos, orden por codigo actual (numerico)\n"
    "rows = c.execute('SELECT id, codigo FROM sg_productos ORDER BY CAST(codigo AS INTEGER)').fetchall()\n"
    "print(f'Productos restantes: {len(rows)}')\n"
    "\n"
    "# Paso 1: temporales\n"
    "for i, (pid, _) in enumerate(rows, start=1):\n"
    "    c.execute('UPDATE sg_productos SET codigo=? WHERE id=?', (f'_t{i}', pid))\n"
    "db.commit()\n"
    "\n"
    "# Paso 2: finales\n"
    "for i, (pid, old) in enumerate(rows, start=1):\n"
    "    c.execute('UPDATE sg_productos SET codigo=? WHERE id=?', (str(i), pid))\n"
    "    if old != str(i):\n"
    "        print(f'  {old} -> {i}')\n"
    "db.commit()\n"
    "db.close()\n"
    "print('DONE')\n"
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, key_filename=SSH_KEY)
sftp = client.open_sftp()
with sftp.open("/tmp/dedup_renum.py", "w") as f:
    f.write(REMOTE)
sftp.close()
_, out, err = client.exec_command("python3 /tmp/dedup_renum.py")
print(out.read().decode())
e = err.read().decode()
if e:
    print("ERR:", e)
client.close()
