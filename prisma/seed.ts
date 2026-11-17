import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const day = (iso: string) => new Date(`${iso}T12:00:00`);

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const viewerEmail = (process.env.SEED_VIEWER_EMAIL ?? "viewer@example.com").toLowerCase();
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "viewer1234";

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, name: "Admin", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 10) },
  });
  await db.user.upsert({
    where: { email: viewerEmail },
    update: {},
    create: { email: viewerEmail, name: "Viewer", role: "VIEWER", passwordHash: await bcrypt.hash(viewerPassword, 10) },
  });

  const categoryNames = ["Laptop", "Desktop", "Monitor", "Phone", "Tablet", "Peripheral", "Networking", "Other"];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const c = await db.category.upsert({ where: { name }, update: {}, create: { name } });
    categories[name] = c.id;
  }

  // Sample data only on an empty inventory, so re-running the seed is safe.
  if ((await db.item.count()) > 0) {
    console.log("Items already exist; skipped sample data.");
    return;
  }

  const [ana, ben, carla] = await Promise.all([
    db.person.create({ data: { name: "Ana Torres", email: "ana.torres@example.com" } }),
    db.person.create({ data: { name: "Ben Okafor", email: "ben.okafor@example.com" } }),
    db.person.create({ data: { name: "Carla Nguyen", email: "carla.nguyen@example.com" } }),
  ]);

  // Laptop: bought, given to Ana, repaired, then moved to Ben.
  await db.item.create({
    data: {
      assetTag: "LT-0001",
      serialNumber: "5CG1234XYZ",
      categoryId: categories.Laptop,
      brand: "Dell",
      model: "Latitude 5440",
      description: "14\" laptop, 16 GB RAM, 512 GB SSD",
      notes: "Good, 8/10. New keyboard.",
      status: "IN_USE",
      purchasePriceCents: 129900,
      purchasedAt: day("2025-02-10"),
      assigneeId: ben.id,
      jobTitle: "Backend Developer",
      location: "HQ, floor 2",
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2025-02-10"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2025-02-12"), personId: ana.id, jobTitle: "Designer", location: "HQ, floor 1", fromStatus: "IN_STORAGE", toStatus: "IN_USE", createdById: admin.id },
          { type: "STATUS_CHANGED", occurredAt: day("2025-09-03"), notes: "Keyboard keys failing", fromStatus: "IN_USE", toStatus: "IN_REPAIR", createdById: admin.id },
          { type: "REPAIRED", occurredAt: day("2025-09-20"), personId: ana.id, notes: "Keyboard replaced under warranty", fromStatus: "IN_REPAIR", toStatus: "IN_USE", createdById: admin.id },
          { type: "UNASSIGNED", occurredAt: day("2026-03-01"), personId: ana.id, jobTitle: "Designer", location: "HQ, floor 1", notes: "Reassigned to Ben Okafor", fromStatus: "IN_USE", toStatus: "IN_USE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2026-03-01"), personId: ben.id, jobTitle: "Backend Developer", location: "HQ, floor 2", fromStatus: "IN_USE", toStatus: "IN_USE", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "MN-0001",
      categoryId: categories.Monitor,
      brand: "LG",
      model: "27UL500",
      description: "27\" 4K monitor",
      notes: "Screen has a dead pixel in the corner",
      status: "IN_USE",
      purchasePriceCents: 32000,
      purchasedAt: day("2024-11-05"),
      assigneeId: carla.id,
      jobTitle: "Accountant",
      location: "Remote",
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2024-11-05"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2024-11-07"), personId: carla.id, jobTitle: "Accountant", location: "Remote", fromStatus: "IN_STORAGE", toStatus: "IN_USE", createdById: admin.id },
          { type: "NOTE", occurredAt: day("2025-06-14"), personId: carla.id, notes: "Screen has a dead pixel in the corner", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "PH-0001",
      serialNumber: "F2LXK9ABC",
      categoryId: categories.Phone,
      brand: "Apple",
      model: "iPhone 14",
      description: "Company phone, 128 GB",
      notes: "Screen not working",
      status: "IN_REPAIR",
      purchasePriceCents: 79900,
      purchasedAt: day("2025-05-20"),
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2025-05-20"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "STATUS_CHANGED", occurredAt: day("2026-10-30"), notes: "Screen not working, sent to vendor", fromStatus: "IN_STORAGE", toStatus: "IN_REPAIR", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "PR-0001",
      categoryId: categories.Peripheral,
      brand: "Logitech",
      model: "MX Keys",
      description: "Wireless keyboard",
      notes: "Like new",
      status: "IN_STORAGE",
      purchasePriceCents: 9999,
      purchasedAt: day("2026-08-01"),
      events: { create: [{ type: "PURCHASED", occurredAt: day("2026-08-01"), notes: "Like new", toStatus: "IN_STORAGE", createdById: admin.id }] },
    },
  });

  console.log(`Seeded users (${adminEmail}, ${viewerEmail}), categories, 3 people and 4 items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
