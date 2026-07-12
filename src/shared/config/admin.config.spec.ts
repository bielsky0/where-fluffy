// admin.config.ts parsuje process.env raz, przy imporcie modułu — testy muszą więc mutować
// process.env PRZED importem i za każdym razem robić jest.resetModules(), żeby wymusić ponowne
// obliczenie ADMIN_EMAILS. Brak tu istniejącego precedensu (cloudinary.config.ts/geocoding.config.ts
// nie mają własnych spec'ów), więc ten wzorzec jest wprowadzony od zera dla tego pliku.
describe('ADMIN_EMAILS', () => {
  const ORIGINAL_ENV = process.env.ADMIN_EMAILS;

  afterEach(() => {
    process.env.ADMIN_EMAILS = ORIGINAL_ENV;
    jest.resetModules();
  });

  const loadAdminEmails = async (): Promise<Set<string>> => {
    jest.resetModules();
    const { ADMIN_EMAILS } = await import('./admin.config.js');
    return ADMIN_EMAILS;
  };

  it('is an empty set when ADMIN_EMAILS is unset', async () => {
    delete process.env.ADMIN_EMAILS;

    const adminEmails = await loadAdminEmails();

    expect(adminEmails.size).toBe(0);
  });

  it('splits a comma-separated list, trimming whitespace and lowercasing each entry', async () => {
    process.env.ADMIN_EMAILS = ' Admin@Example.com , second@Example.com ';

    const adminEmails = await loadAdminEmails();

    expect(adminEmails).toEqual(new Set(['admin@example.com', 'second@example.com']));
  });

  it('filters out empty entries from stray/trailing commas', async () => {
    process.env.ADMIN_EMAILS = 'admin@example.com,,';

    const adminEmails = await loadAdminEmails();

    expect(adminEmails).toEqual(new Set(['admin@example.com']));
  });
});
