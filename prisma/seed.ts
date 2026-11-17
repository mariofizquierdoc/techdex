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
    create: {
      email: adminEmail,
      name: "Administrador",
      role: "ADMIN",
      locale: "es-MX",
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });
  await db.user.upsert({
    where: { email: viewerEmail },
    update: {},
    create: {
      email: viewerEmail,
      name: "Consulta",
      role: "VIEWER",
      locale: "es-MX",
      passwordHash: await bcrypt.hash(viewerPassword, 10),
    },
  });

  // Category names are data, stored in Spanish and not translated.
  const categoryNames = {
    laptop: "Laptop",
    desktop: "Computadora de escritorio",
    monitor: "Monitor",
    phone: "Celular",
    tablet: "Tableta",
    peripheral: "Periférico",
    networking: "Redes",
    other: "Otro",
  };
  const categories = {} as Record<keyof typeof categoryNames, string>;
  for (const [key, name] of Object.entries(categoryNames) as [keyof typeof categoryNames, string][]) {
    const c = await db.category.upsert({ where: { name }, update: {}, create: { name } });
    categories[key] = c.id;
  }

  // Sample data only on an empty inventory, so re-running the seed is safe.
  if ((await db.item.count()) > 0) {
    console.log("Ya existen artículos; se omitieron los datos de ejemplo.");
    return;
  }

  const [ana, beto, carla] = await Promise.all([
    db.person.create({ data: { name: "Ana Torres", email: "ana.torres@example.com" } }),
    db.person.create({ data: { name: "Alberto Ramírez", email: "alberto.ramirez@example.com" } }),
    db.person.create({ data: { name: "Carla Hernández", email: "carla.hernandez@example.com" } }),
  ]);

  // Laptop: bought, given to Ana, repaired, then moved to Alberto.
  await db.item.create({
    data: {
      assetTag: "LT-0001",
      serialNumber: "5CG1234XYZ",
      categoryId: categories.laptop,
      brand: "Dell",
      model: "Latitude 5440",
      description: "Laptop de 14\", 16 GB de RAM, SSD de 512 GB",
      notes: "Buena, 8/10. Teclado nuevo.",
      status: "IN_USE",
      purchasePriceCents: 129900,
      purchasedAt: day("2025-02-10"),
      assigneeId: beto.id,
      jobTitle: "Desarrollador backend",
      location: "Oficina central, piso 2",
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2025-02-10"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2025-02-12"), personId: ana.id, jobTitle: "Diseñadora", location: "Oficina central, piso 1", fromStatus: "IN_STORAGE", toStatus: "IN_USE", createdById: admin.id },
          { type: "STATUS_CHANGED", occurredAt: day("2025-09-03"), notes: "Fallan algunas teclas", fromStatus: "IN_USE", toStatus: "IN_REPAIR", createdById: admin.id },
          { type: "REPAIRED", occurredAt: day("2025-09-20"), personId: ana.id, notes: "Se cambió el teclado por garantía", fromStatus: "IN_REPAIR", toStatus: "IN_USE", createdById: admin.id },
          { type: "UNASSIGNED", occurredAt: day("2026-03-01"), personId: ana.id, jobTitle: "Diseñadora", location: "Oficina central, piso 1", fromStatus: "IN_USE", toStatus: "IN_USE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2026-03-01"), personId: beto.id, jobTitle: "Desarrollador backend", location: "Oficina central, piso 2", fromStatus: "IN_USE", toStatus: "IN_USE", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "MN-0001",
      categoryId: categories.monitor,
      brand: "LG",
      model: "27UL500",
      description: "Monitor 4K de 27\"",
      notes: "Tiene un píxel muerto en una esquina",
      status: "IN_USE",
      purchasePriceCents: 32000,
      purchasedAt: day("2024-11-05"),
      assigneeId: carla.id,
      jobTitle: "Contadora",
      location: "Home office",
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2024-11-05"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "ASSIGNED", occurredAt: day("2024-11-07"), personId: carla.id, jobTitle: "Contadora", location: "Home office", fromStatus: "IN_STORAGE", toStatus: "IN_USE", createdById: admin.id },
          { type: "NOTE", occurredAt: day("2025-06-14"), personId: carla.id, notes: "Tiene un píxel muerto en una esquina", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "CL-0001",
      serialNumber: "F2LXK9ABC",
      categoryId: categories.phone,
      brand: "Apple",
      model: "iPhone 14",
      description: "Celular de la empresa, 128 GB",
      notes: "La pantalla no funciona",
      status: "IN_REPAIR",
      purchasePriceCents: 79900,
      purchasedAt: day("2025-05-20"),
      events: {
        create: [
          { type: "PURCHASED", occurredAt: day("2025-05-20"), toStatus: "IN_STORAGE", createdById: admin.id },
          { type: "STATUS_CHANGED", occurredAt: day("2026-10-30"), notes: "La pantalla no funciona; se envió al proveedor", fromStatus: "IN_STORAGE", toStatus: "IN_REPAIR", createdById: admin.id },
        ],
      },
    },
  });

  await db.item.create({
    data: {
      assetTag: "PR-0001",
      categoryId: categories.peripheral,
      brand: "Logitech",
      model: "MX Keys",
      description: "Teclado inalámbrico",
      notes: "Como nuevo",
      status: "IN_STORAGE",
      purchasePriceCents: 9999,
      purchasedAt: day("2026-08-01"),
      events: { create: [{ type: "PURCHASED", occurredAt: day("2026-08-01"), notes: "Como nuevo", toStatus: "IN_STORAGE", createdById: admin.id }] },
    },
  });

  console.log(`Datos iniciales creados: usuarios (${adminEmail}, ${viewerEmail}), categorías, 3 personas y 4 artículos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
