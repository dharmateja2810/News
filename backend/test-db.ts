import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config({ path: 'config.env' }); // load from config.env

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL }
    }
  });

  console.log('Testing connection to URL (masked):', process.env.DATABASE_URL?.replace(/:([^:]+)@/, ':***@'));

  try {
    await prisma.$connect();
    console.log('✅ Connected direct!');
  } catch (e) {
    console.error('❌ Connection error:', e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
