import { z } from 'zod';

// Mirrors geocoding.config.ts's non-throwing .default() pattern (not cloudinary.config.ts's
// throw-on-missing pattern) — pusta lista adminów to poprawny stan "żadna trasa admina jeszcze
// nieużywana", a nie błąd konfiguracji uniemożliwiający start procesu. Brama do POST /pets/admin
// (Content Seeding, patrz shared/middleware/require-admin.middleware.ts) — celowo bez osobnego
// pola `role`/JWT claim, patrz plan/dyskusja: admin-owość to wyłącznie ten allowlist sprawdzany
// przeciwko już uwierzytelnionemu req.user.email.
const adminEnvSchema = z.object({
  ADMIN_EMAILS: z.string().default(''),
});

const parsed = adminEnvSchema.parse(process.env);

export const ADMIN_EMAILS: Set<string> = new Set(
  parsed.ADMIN_EMAILS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
