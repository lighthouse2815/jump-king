const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    
    console.log('Navigating to http://localhost:3000 ...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
    
    console.log('Wait a few seconds for Phaser to start...');
    await new Promise(r => setTimeout(r, 3000));
    
    await browser.close();
    console.log('Done.');
  } catch (err) {
    console.error('PUPPETEER ERROR:', err);
  }
})();
