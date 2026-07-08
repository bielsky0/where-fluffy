// Podzbiór opcji rate-limiter-flexible, które faktycznie konfigurujemy — resztę (execEvenly,
// insuranceLimiter, itd.) świadomo pomijamy, YAGNI, dopóki nie będzie potrzeby.
export type RateLimiterOptions = {
  keyPrefix: string;
  points: number; // maksymalna liczba żądań/zdarzeń w oknie
  duration: number; // długość okna w sekundach
  blockDuration?: number; // po przekroczeniu limitu, dodatkowa blokada w sekundach
};
