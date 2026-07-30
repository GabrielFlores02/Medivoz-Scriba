import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nombreCompleto: z.string().min(3),
  especialidadId: z.union([z.number(), z.string()]).optional(),
  especialidadIds: z.array(z.number().int().min(1)).max(20).optional(),
  especialidadPrincipalId: z.number().int().min(1).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
