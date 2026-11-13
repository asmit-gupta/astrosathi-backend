import { PrismaClient } from '@prisma/client';
import { seed } from './seed';

const prisma = new PrismaClient();
seed(prisma)
  .then((r) => console.log('Seed complete:', r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
