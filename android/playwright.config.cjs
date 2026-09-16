module.exports = {
  testDir: './tests', testMatch: '**/adapter.spec.cjs', timeout: 45000,
  workers: 1, outputDir: '../android-evidence/browser',
  reporter: [['list'], ['json', {outputFile: 'android-evidence/browser-report.json'}]],
  use: {browserName: 'chromium', viewport: {width: 390, height: 844}, serviceWorkers: 'block'}
};
