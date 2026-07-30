-- Rol Evaluador: acceso exclusivo a evaluación documental pseudonimizada.
-- Mantiene compatibilidad con instalaciones que usaron el rol legado coordinador.
ALTER TYPE rol_aplicacion ADD VALUE IF NOT EXISTS 'evaluador';

UPDATE roles_usuario
SET rol = 'administrador'
WHERE rol = 'coordinador';
