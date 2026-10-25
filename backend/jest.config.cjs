module.exports = {
  rootDir: '.',
  testRegex: '(/test/.*|\\.spec)\\.ts$',
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { ...require('./tsconfig.json').compilerOptions, module: 'ESNext' } }] },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
};
