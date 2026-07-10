import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Create default admin user ──────────
  const passwordHash = await bcrypt.hash("Rath@123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "sonu.prajapati@rathinfotech.com" },
    update: { passwordHash, role: UserRole.SUPER_ADMIN, isActive: true },
    create: {
      email: "sonu.prajapati@rathinfotech.com",
      passwordHash,
      name: "Sonu Prajapati",
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log(`✅ Created admin user: ${admin.email}`);

  // ── Create a demo event ────────────────
  const event = await prisma.event.create({
    data: {
      name: "Demo Expo 2026",
      description: "A demonstration exhibition event",
      organizer: "Demo Corp",
      venue: "Convention Center",
      city: "Mumbai",
      country: "India",
      startDate: new Date("2026-01-15T09:00:00Z"),
      endDate: new Date("2026-01-17T18:00:00Z"),
      status: "ACTIVE",
      createdBy: admin.id,
    },
  });

  console.log(`✅ Created event: ${event.name}`);

  // ── Create default visitor types ───────
  const visitorTypes = [
    { name: "End User", slug: "end-user", color: "#3B82F6" },
    { name: "Dealer", slug: "dealer", color: "#10B981" },
    { name: "Distributor", slug: "distributor", color: "#8B5CF6" },
    { name: "Competitor", slug: "competitor", color: "#EF4444" },
    { name: "OEM", slug: "oem", color: "#F59E0B" },
    { name: "Vendor", slug: "vendor", color: "#6366F1" },
    { name: "Consultant", slug: "consultant", color: "#EC4899" },
    { name: "Architect", slug: "architect", color: "#14B8A6" },
    { name: "Builder", slug: "builder", color: "#F97316" },
  ];

  for (let i = 0; i < visitorTypes.length; i++) {
    await prisma.visitorType.create({
      data: {
        eventId: event.id,
        ...visitorTypes[i]!,
        displayOrder: i,
      },
    });
  }

  console.log(`✅ Created ${visitorTypes.length} visitor types`);

  // ── Create a demo booth ────────────────
  const booth = await prisma.booth.create({
    data: {
      eventId: event.id,
      name: "Main Booth",
      locationHint: "Hall A, Row 1",
    },
  });

  console.log(`✅ Created booth: ${booth.name}`);

  // ── Create a default form definition with fields ──
  const formDef = await prisma.formDefinition.create({
    data: {
      eventId: event.id,
      name: "Lead Capture Form",
    },
  });

  const defaultFields = [
    { fieldKey: "company_name", fieldType: "TEXT" as const, label: "Company Name", isRequired: true, displayOrder: 0 },
    { fieldKey: "contact_person", fieldType: "TEXT" as const, label: "Contact Person", isRequired: true, displayOrder: 1 },
    { fieldKey: "mobile_number", fieldType: "PHONE" as const, label: "Mobile Number", isRequired: true, displayOrder: 2 },
    { fieldKey: "email", fieldType: "EMAIL" as const, label: "Email", isRequired: true, displayOrder: 3 },
    { fieldKey: "designation", fieldType: "TEXT" as const, label: "Designation", displayOrder: 4 },
    { fieldKey: "city", fieldType: "TEXT" as const, label: "City", displayOrder: 5 },
    { fieldKey: "state", fieldType: "TEXT" as const, label: "State", displayOrder: 6 },
    { fieldKey: "country", fieldType: "TEXT" as const, label: "Country", displayOrder: 7 },
    { fieldKey: "website", fieldType: "URL" as const, label: "Website", displayOrder: 8 },
    { fieldKey: "gst_number", fieldType: "TEXT" as const, label: "GST Number", displayOrder: 9 },
    { fieldKey: "industry", fieldType: "TEXT" as const, label: "Industry", displayOrder: 10 },
    { fieldKey: "annual_turnover", fieldType: "TEXT" as const, label: "Annual Turnover", displayOrder: 11 },
    { fieldKey: "products_interested", fieldType: "TEXTAREA" as const, label: "Products Interested In", displayOrder: 12 },
    { fieldKey: "budget", fieldType: "TEXT" as const, label: "Budget", displayOrder: 13 },
    { fieldKey: "remarks", fieldType: "TEXTAREA" as const, label: "Remarks", displayOrder: 14 },
  ];

  for (const field of defaultFields) {
    await prisma.formField.create({
      data: {
        formDefinitionId: formDef.id,
        ...field,
      },
    });
  }

  console.log(`✅ Created form definition with ${defaultFields.length} fields`);

  console.log("\n🎉 Seeding complete!");
  console.log("   Admin login: sonu.prajapati@rathinfotech.com / Rath@123");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
