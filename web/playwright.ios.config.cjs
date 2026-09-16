const {devices}=require('@playwright/test');
const base=require('./playwright.config.cjs');
module.exports={...base,testMatch:['**/smoke.spec.cjs','**/paper.spec.cjs','**/trading.spec.cjs','**/wallet-ux.spec.cjs','**/futures-ux.spec.cjs','**/navigation-scroll.spec.cjs','**/account-panel-scroll.spec.cjs','**/funding-wallet.spec.cjs','**/funding-bridge.spec.cjs'],outputDir:'../test-results-ios',use:{...base.use,...devices['iPhone 13'],browserName:'webkit'},reporter:'list'};
