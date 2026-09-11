#!/usr/bin/env python3
"""
Script para crear un usuario VISOR de prueba
Ejecutar: python create_visor_user.py
"""

import sys
import os
sys.path.insert(0, '.')

from src.services.users_service import create_user
from src.utils.logger import logger

print("=" * 70)
print("Creando usuario VISOR de prueba...")
print("=" * 70)

try:
    # Crear usuario visor
    result = create_user(
        username="visor",
        password="visor123",
        role="VISOR",
        nombre="Usuario Visor"
    )
    
    print(f"\n✓ Usuario creado exitosamente!")
    print(f"  Username: visor")
    print(f"  Password: visor123")
    print(f"  Role: VISOR")
    print(f"\nAhora puedes iniciar sesión en http://localhost:5173/login")
    
except Exception as e:
    print(f"\n✗ Error al crear usuario: {e}")
    
    # Si el error es porque el usuario ya existe, es OK
    if "UNIQUE constraint failed" in str(e) or "unique" in str(e).lower():
        print("\n✓ El usuario VISOR ya existe")
        print(f"  Username: visor")
        print(f"  Password: visor123 (o tu contraseña)")
    else:
        raise

print("\n" + "=" * 70)
