module.exports = {
    testEnvironment: 'node',
    coverageDirectory: 'coverage',
    collectCoverageFrom: [
        'routes/**/*.js',
        'middleware/**/*.js',
        'models/**/*.js',
    ],
    testMatch: ['**/tests/**/*.test.js'],
    setupFilesAfterEnv: ['./tests/setup.js'],
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    testTimeout: 10000,
};
