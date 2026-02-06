const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

const prisma = new PrismaClient();

async function main() {
  await prisma.article.deleteMany({});
  console.log('✅ Deleted all articles');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
