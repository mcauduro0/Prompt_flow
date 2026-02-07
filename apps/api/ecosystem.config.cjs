const fs = require('fs');
const dotenv = require('dotenv');
const envConfig = dotenv.parse(fs.readFileSync('/opt/arc/.env'));

module.exports = {
  apps: [{
    name: 'arc-api',
    script: 'dist/index.js',
    cwd: '/opt/arc/apps/api',
    env: envConfig,
  }]
};
