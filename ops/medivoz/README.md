# Operaciones seguras de MediVoz

Estas herramientas reemplazan el uso directo de los scripts heredados de
`vps_tools`. No contienen credenciales y no aceptan password SSH en linea de
comandos.

## Reglas

- Usar llave SSH y un usuario limitado; no usar `root` por password.
- Copiar `.env.example` fuera del repositorio y completar los valores en un
  gestor de secretos o entorno protegido.
- Ejecutar primero `audit_vps.py`.
- Crear y verificar un backup antes de desplegar.
- El despliegue usa releases versionados. No resetea ni elimina la base de
  datos.
- `deploy.py` es `dry-run` por defecto. Requiere `--execute` para cambiar el
  servidor.
- Aplicar `DB/03_medivoz_escriba_2_0.sql` en staging antes del piloto.
- Ejecutar `smoke_test.py` despues de cada despliegue.

## Ejemplos

```powershell
python ops/medivoz/audit_vps.py
python ops/medivoz/backup_db.py
python ops/medivoz/deploy.py --release 2.0.0
python ops/medivoz/deploy.py --release 2.0.0 --execute
python ops/medivoz/smoke_test.py
```

Los reportes se escriben en `ops/reports/`, que no debe contener secretos.
