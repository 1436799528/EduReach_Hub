const fs = require('fs');
const path = require('path');
const chromium = require('@sparticuz/chromium');

(async () => {
  const exe = await chromium.executablePath;
  console.log(`Chromium path: ${exe}`);
  // If it's a tar/brotli file, @sparticuz/chromium usually inflates it to /tmp automatically when you await executablePath!
})();