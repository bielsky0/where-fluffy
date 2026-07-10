// Jedyne źródło prawdy dla sekretu podpisującego JWT — wcześniej ten sam fallback-literał był
// niezależnie zduplikowany w modules/auth/index.ts, shared/middleware/auth.middleware.ts oraz
// shared/infrastructure/socket.ts (patrz CLAUDE.md). Wszystkie trzy miejsca importują teraz tę
// jedną stałą, żeby nie mogły się rozjechać.
export const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
