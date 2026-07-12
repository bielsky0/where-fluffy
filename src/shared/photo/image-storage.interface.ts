export type ImageStorageProvider = {
  upload: (base64: string) => Promise<string>;
  remove: (url: string) => Promise<void>;
};
