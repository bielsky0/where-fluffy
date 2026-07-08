/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  // '/dist/' matters now that `npm run build` (added for the Dockerfile) exists — without it,
  // Jest's own testMatch picks up the compiled *.spec.js copies there too and fails on them
  // ("Cannot use import statement outside a module": dist/ is plain ESM output, not run through
  // ts-jest's transform below, which only applies to *.ts).
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
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
