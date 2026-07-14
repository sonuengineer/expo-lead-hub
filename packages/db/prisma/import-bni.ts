import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

// The three BNI directory exports live in the repo's /data folder.
const DATA_DIR = resolve(__dirname, "../../../data");
const FILES = [
  "bni_members_2026-06-25.csv",
  "bni_members_2026-06-25(1).csv",
  "bni_members_2026-06-25(2).csv",
];

const clean = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
};

// Last 10 digits of the E.164 number → stable match key (empty → null).
function normalizePhone(e164: string | null, phone: string | null): string | null {
  const digits = String(e164 || phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

async function main() {
  console.log("🌱 Importing BNI members…");
  let total = 0;
  let imported = 0;
  const seen = new Set<string>();

  for (const file of FILES) {
    const path = resolve(DATA_DIR, file);
    if (!existsSync(path)) {
      console.warn(`⚠️  Missing: ${path} — skipping`);
      continue;
    }
    const rows: Record<string, string>[] = parse(readFileSync(path), {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    });
    console.log(`   ${file}: ${rows.length} rows`);

    for (const r of rows) {
      total++;
      const phoneE164 = normalizePhone(clean(r["Phone E.164"]), clean(r["Phone"]));
      const name = clean(r["Name"]);
      if (!name) continue;

      // Dedupe within this run: by phone if present, else name+company.
      const key = phoneE164 ?? `${name}|${clean(r["Company"]) ?? ""}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const data = {
        name,
        company: clean(r["Company"]),
        profession: clean(r["Profession"]),
        phone: clean(r["Phone"]),
        phoneE164,
        website: clean(r["Website"]),
        chapter: clean(r["Chapter"]),
        region: clean(r["Region"]),
        city: clean(r["City"]),
        country: clean(r["Country"]),
        status: clean(r["Status"]),
        meetingDay: clean(r["Meeting Day"]),
        meetingTime: clean(r["Meeting Time"]),
        venue: clean(r["Venue"]),
        profileUrl: clean(r["Profile URL"]),
        firstSeen: clean(r["First Seen"]),
        lastSeen: clean(r["Last Seen"]),
      };

      // Upsert on phoneE164 when we have one (so re-runs update); otherwise create.
      if (phoneE164) {
        await prisma.bniMember.upsert({
          where: { phoneE164 },
          update: data,
          create: data,
        });
      } else {
        await prisma.bniMember.create({ data });
      }
      imported++;
    }
  }

  const count = await prisma.bniMember.count();
  console.log(`✅ Processed ${total} rows, imported/updated ${imported}. Table now has ${count} members.`);
}

main()
  .catch((e) => {
    console.error("❌ BNI import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
