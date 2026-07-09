export type PhotoService = {
  store: (base64: string) => Promise<string>;
};

// Mock "S3-ready" storage: dziś po prostu zwraca to, co dostał (klient wysyła skompresowany
// base64 data URL), więc `photoUrl` w bazie to bezpośrednio ten string. Docelowo, po podpięciu
// prawdziwego S3, ta funkcja zrobi upload i zwróci prawdziwy URL — reszta aplikacji (repozytorium,
// frontend) nie zauważy różnicy, bo dla nich `photoUrl` zawsze był tylko stringiem.
export const createPhotoService = (): PhotoService => {
  const store = async (base64: string): Promise<string> => base64;

  return { store };
};
