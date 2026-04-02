const { execSync } = require('child_process');
const fs = require('fs');

const env = fs.readFileSync('config.env', 'utf-8');
const match = env.match(/DATABASE_URL="([^"]+)"/);
if (!match) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

let url = match[1];
// For Prisma DB push, we need the direct pooler port exactly without pgbouncer
url = url.replace(':6543', ':5432').replace('?pgbouncer=true', '');

console.log('Pushing schema to direct URL...');
try {
  execSync('npx prisma db push', { 
    env: { ...process.env, DATABASE_URL: url }, 
    stdio: 'inherit' 
  });
  console.log('✅ Success!');
} catch (e) {
  console.error('Failed to push:', e.message);
}
