// Jedyne źródło prawdy dla sekretu podpisującego JWT — wcześniej ten sam fallback-literał był
// niezależnie zduplikowany w modules/auth/index.ts, shared/middleware/auth.middleware.ts oraz
// shared/infrastructure/socket.ts (patrz CLAUDE.md). Wszystkie trzy miejsca importują teraz tę
// jedną stałą, żeby nie mogły się rozjechać.
const FALLBACK_JWT_SECRET = 'super-secret-key-change-me';

// Fallback zostaje dla dev/test (nie ma sensu wymagać .env do samego `npm run dev`), ale na
// produkcji podpisywanie tokenów znanym z repo literałem jest równoznaczne z brakiem
// jakiegokolwiek sekretu — więc tam wysadzamy proces na starcie zamiast dać się temu wykryć
// dopiero przy pierwszym incydencie.
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === FALLBACK_JWT_SECRET)) {
  throw new Error(
    'JWT_SECRET must be set to a real secret in production (it is currently unset or equal to the well-known fallback value).',
  );
}

export const JWT_SECRET = process.env.JWT_SECRET || FALLBACK_JWT_SECRET;
