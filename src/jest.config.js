/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    // Kod aplikacji (NodeNext ESM) używa jawnego rozszerzenia ".js" w lokalnych importach
    // (np. "./pets.mapper.js"). Ścinamy je, żeby CJS-owy resolver Jesta trafiał na sąsiedni
    // plik ".ts" zamiast szukać nieistniejącego ".js".
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          // Szybka transpilacja per-plik bez pełnego cross-file type-checkingu — bramką typów
          // pozostaje `npx tsc --noEmit`, uruchamiane osobno.
          isolatedModules: true,
        },
      },
    ],
  },
};
