import crypto from "crypto";
import { and, asc, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { hashPassword, comparePassword } from "../../core/utils/hash.js";
import { db } from "../../db/index.js";
import {
  users,
  profiles,
  sessions,
  userRoles,
  specialities,
  userSpecialities,
} from "../../db/schema/auth.js";
import { RegisterInput, LoginInput } from "./auth.schema.js";
import { STUDY_SPECIALTIES } from "../study/study.policy.js";

const SPECIALITY_LABELS: Record<(typeof STUDY_SPECIALTIES)[number], string> = {
  Hematologia: "Hematología",
  Neurologia: "Neurología",
  Psiquiatria: "Psiquiatría",
  Reumatologia: "Reumatología",
  Endocrinologia: "Endocrinología",
};

function getSpecialityLabel(name: string) {
  return SPECIALITY_LABELS[name as keyof typeof SPECIALITY_LABELS] ?? name;
}

export class AuthService {
  private buildRotatingRefreshToken() {
    const refreshToken = crypto.randomBytes(40).toString("hex");
    const refreshTokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    return { refreshToken, refreshTokenHash, expiresAt };
  }

  async getUserAuthPayload(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const roles = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, user.id),
    });
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, user.id),
    });
    const specialityRows = await db
      .select({
        id: specialities.id,
        nombre: specialities.nombre,
        esPrincipal: userSpecialities.esPrincipal,
      })
      .from(userSpecialities)
      .innerJoin(
        specialities,
        eq(userSpecialities.especialidadId, specialities.id)
      )
      .where(
        and(
          eq(userSpecialities.userId, user.id),
          eq(specialities.activa, true),
          eq(specialities.esAdministrativa, false),
          inArray(specialities.nombre, [...STUDY_SPECIALTIES])
        )
      )
      .orderBy(desc(userSpecialities.esPrincipal), asc(specialities.nombre));
    const visibleSpecialityRows = specialityRows.map((item) => ({
      ...item,
      nombre: getSpecialityLabel(item.nombre),
    }));

    const rol = roles.some((r) => r.rol === "administrador")
      ? "administrador"
      : roles.some((r) => r.rol === "coordinador")
        ? "coordinador"
        : "doctor";

    return {
      id: user.id,
      email: user.email,
      rol,
      nombreCompleto: profile?.nombreCompleto ?? "",
      especialidades: visibleSpecialityRows,
      especialidadPrincipal:
        visibleSpecialityRows.find((item) => item.esPrincipal) ??
        visibleSpecialityRows[0] ??
        null,
    };
  }

  async listSelectableSpecialities() {
    const rows = await db
      .select({
        id: specialities.id,
        nombre: specialities.nombre,
      })
      .from(specialities)
      .where(
        and(
          eq(specialities.activa, true),
          eq(specialities.esAdministrativa, false),
          inArray(specialities.nombre, [...STUDY_SPECIALTIES])
        )
      )
      .orderBy(asc(specialities.nombre));

    return rows.map((item) => ({
      ...item,
      nombre: getSpecialityLabel(item.nombre),
    }));
  }

  async register(input: RegisterInput) {
    const {
      email,
      password,
      nombreCompleto,
      especialidadId,
      especialidadIds,
      especialidadPrincipalId,
    } = input;

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      throw new Error("El correo ya esta registrado");
    }

    const passwordHash = await hashPassword(password);
    const legacySpecialityId =
      typeof especialidadId === "string"
        ? Number.parseInt(especialidadId, 10)
        : especialidadId;
    const requestedIds = Array.from(
      new Set(
        (especialidadIds ?? (legacySpecialityId ? [legacySpecialityId] : []))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    const principalId = especialidadPrincipalId ?? requestedIds[0] ?? null;

    if (principalId && !requestedIds.includes(principalId)) {
      throw new Error("La especialidad principal debe estar seleccionada");
    }

    if (requestedIds.length > 0) {
      const validSpecialities = await db
        .select({ id: specialities.id })
        .from(specialities)
        .where(
          and(
            inArray(specialities.id, requestedIds),
            eq(specialities.activa, true),
            eq(specialities.esAdministrativa, false),
            inArray(specialities.nombre, [...STUDY_SPECIALTIES])
          )
        );

      if (validSpecialities.length !== requestedIds.length) {
        throw new Error("Una o más especialidades no están disponibles");
      }
    }

    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          estado: "activa",
        })
        .returning();

      await tx.insert(profiles).values({
        userId: newUser.id,
        nombreCompleto,
        especialidadId: principalId,
      });

      if (requestedIds.length > 0) {
        await tx.insert(userSpecialities).values(
          requestedIds.map((selectedId) => ({
            userId: newUser.id,
            especialidadId: selectedId,
            esPrincipal: selectedId === principalId,
          }))
        );
      }

      await tx.insert(userRoles).values({
        userId: newUser.id,
        rol: "doctor",
      });

      return newUser;
    });
  }

  async login(input: LoginInput, context: { ip?: string; userAgent?: string }) {
    const { email, password } = input;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw new Error("Credenciales invalidas");
    }

    if (user.estado !== "activa") {
      throw new Error(`Tu cuenta esta ${user.estado}`);
    }

    const authUser = await this.getUserAuthPayload(user.id);
    const { refreshToken, refreshTokenHash, expiresAt } = this.buildRotatingRefreshToken();

    await db.insert(sessions).values({
      userId: user.id,
      refreshTokenHash,
      dispositivo: context.userAgent,
      ip: context.ip,
      userAgent: context.userAgent,
      expiraEn: expiresAt,
      ultimaActividad: new Date(),
    });

    await db
      .update(users)
      .set({ ultimoLogin: new Date() })
      .where(eq(users.id, user.id));

    return {
      user: authUser,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const now = new Date();

    const session = await db.query.sessions.findFirst({
      where: and(eq(sessions.refreshTokenHash, hash), isNull(sessions.revocadaEn)),
    });

    if (!session) {
      throw new Error("Sesion invalida o expirada");
    }

    if (session.expiraEn < now) {
      await db
        .update(sessions)
        .set({ revocadaEn: now, ultimaActividad: now })
        .where(
          and(
            eq(sessions.id, session.id),
            eq(sessions.refreshTokenHash, hash),
            isNull(sessions.revocadaEn)
          )
        );
      throw new Error("Sesion invalida o expirada");
    }

    const { refreshToken: nextRefreshToken, refreshTokenHash, expiresAt } =
      this.buildRotatingRefreshToken();

    const rotated = await db
      .update(sessions)
      .set({
        refreshTokenHash,
        ultimaActividad: now,
        expiraEn: expiresAt,
      })
      .where(
        and(
          eq(sessions.id, session.id),
          eq(sessions.refreshTokenHash, hash),
          isNull(sessions.revocadaEn),
          gte(sessions.expiraEn, now)
        )
      )
      .returning({
        userId: sessions.userId,
      });

    const rotatedSession = rotated[0];
    if (!rotatedSession) {
      throw new Error("Sesion invalida o expirada");
    }

    const user = await this.getUserAuthPayload(rotatedSession.userId);

    return {
      user,
      refreshToken: nextRefreshToken,
    };
  }
}

export const authService = new AuthService();
