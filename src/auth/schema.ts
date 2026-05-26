import { z } from 'zod';

export const RegisterDTO = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  /** Optionally migrate guest portfolios on registration */
  guestSessionId: z.string().uuid().optional(),
});

export const LoginDTO = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const MigrateGuestDTO = z.object({
  guestSessionId: z.string().uuid(),
});

export type RegisterInput = z.infer<typeof RegisterDTO>;
export type LoginInput = z.infer<typeof LoginDTO>;
