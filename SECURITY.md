# Seguridad

## Credenciales

Nunca se deben guardar claves, contraseñas, tokens, certificados privados ni
cadenas de conexión reales en Git.

1. Copie `.env.example` como `.env`.
2. Complete los valores únicamente en el archivo local `.env` o en el gestor de
   secretos del entorno de despliegue.
3. Mantenga las variables `OPENAI_API_KEY`, `JWT_SECRET`,
   `REFRESH_TOKEN_SECRET`, `DB_PASSWORD` y `DATABASE_URL` fuera del repositorio.
4. Si una credencial se publica por error, debe revocarse y rotarse; eliminarla
   de un commit posterior no la retira del historial.

Los archivos `.env.example` contienen solo marcadores y pueden versionarse.

## Datos clínicos

No se deben subir audios, transcripciones, exportaciones, copias de base de
datos, reportes con pacientes ni archivos de depuración con información clínica.
Las carpetas de ejecución local, cargas, respaldos y reportes generados están
excluidas mediante `.gitignore`.

## Reporte de vulnerabilidades

No abra un issue público que contenga datos clínicos o credenciales. Comuníquese
de forma privada con el responsable del repositorio y describa únicamente los
pasos técnicos necesarios para reproducir el problema.
