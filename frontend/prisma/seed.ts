import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Student123!", 10);
  await prisma.user.upsert({
    where: { email: "sam@codementor.dev" },
    update: {},
    create: { name: "Sam Lee", email: "sam@codementor.dev", passwordHash: hash },
  });

  console.log("Seeded:");
  console.log("  User -> sam@codementor.dev / Student123!");
  console.log("");
  console.log("No sample snippets seeded — generate or paste code in the");
  console.log("Workspace once both services are running (and the backend");
  console.log("model is trained: `python train.py` in backend/).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
