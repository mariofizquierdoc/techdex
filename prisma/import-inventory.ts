/**
 * One-off import of the IT inventory spreadsheet ("INVENTARIO SISTEMAS.xlsx") into techdex.
 *
 *   npm run db:import -- "C:\path\INVENTARIO SISTEMAS.xlsx" --dry-run   # report only, writes nothing
 *   npm run db:import -- "C:\path\INVENTARIO SISTEMAS.xlsx"             # import
 *
 * The sheet is maintained by hand and split into sections (main office, branches, printers,
 * scanners, licences, retired equipment, spare equipment) that use the columns differently,
 * so each section has its own row parser. Columns and cells holding passwords, Wi-Fi keys,
 * licence keys or remote-access accounts are never read.
 *
 * Needs an ADMIN user (run `npm run db:seed` first) because every event records its author.
 * Refuses to run twice: import into a fresh database (`npm run db:reset`) to redo it.
 */
import { basename } from "node:path";
import ExcelJS from "exceljs";
import { PrismaClient, type ItemStatus } from "@prisma/client";

const EMAIL_DOMAIN = "medecsa.com";
const MAIN_CITY = "Guayaquil";
const IMPORT_MARKER = "Imported from spreadsheet";

// ---------------------------------------------------------------------------------------------
// Text helpers

type CellValue = ExcelJS.CellValue;

function cellText(v: CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v && v.richText) return v.richText.map((t) => t.text).join("");
    if ("formula" in v || "sharedFormula" in v) return cellText((v as ExcelJS.CellFormulaValue).result as CellValue);
    if ("text" in v) return cellText(v.text as CellValue);
    if ("error" in v) return "";
  }
  return String(v);
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
/** Uppercase, accent-free, single-spaced: for comparisons only. */
const norm = (s: string) => stripAccents(clean(s)).toUpperCase();

const LOWER_WORDS = new Set(["y", "de", "del", "la", "las", "los", "e"]);
const UPPER_WORDS = new Set(["SAC", "HP", "GYE", "UPS", "DVR", "IP", "TI"]);

/** "FACT. Y COBRANZAS" -> "Fact. y Cobranzas", "JENIFER CEDEÑO" -> "Jenifer Cedeño". */
function title(s: string): string {
  return clean(s).replace(/[^\s\-/]+/g, (w, offset: number) => {
    if (UPPER_WORDS.has(norm(w))) return w.toUpperCase();
    const lower = w.toLowerCase();
    if (offset > 0 && LOWER_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });
}

const CITIES: Record<string, string> = {
  QUITO: "Quito",
  MANTA: "Manta",
  MACHALA: "Machala",
  CUENCA: "Cuenca",
  GYE: "Guayaquil",
  GUAYAQUIL: "Guayaquil",
};

function cityIn(s: string): string | undefined {
  for (const word of norm(s).split(/[\s\-/]+/)) if (CITIES[word]) return CITIES[word];
  return undefined;
}

function withoutCity(s: string): string {
  return clean(norm(s).split(/\s+/).some((w) => CITIES[w]) ? s.split(/\s+/).filter((w) => !CITIES[norm(w)]).join(" ") : s);
}

const ipv4 = (s: string) => s.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0];
const anyDesk = (s: string) => (/^\d[\d ]{6,}$/.test(clean(s)) ? s.replace(/\s/g, "") : undefined);
const isDamaged = (s: string) => /^DANAD[OA]$/.test(norm(s));

/** Defensive filter for any free text we copy: passwords, Wi-Fi, licence keys, accounts, URLs. */
function looksSensitive(s: string): boolean {
  return (
    /clave|pass|contrase|admin|wifi|usuario:|@|https?:|\\\\/i.test(s) ||
    /[A-Z0-9]{5}(-[A-Z0-9]{5}){4}/i.test(s) ||
    /medec\d|abc\d|asd\d|cedem\d/i.test(s)
  );
}

// ---------------------------------------------------------------------------------------------
// Brands and people

const BRANDS: Record<string, string> = {
  LENOVO: "Lenovo",
  HP: "HP",
  DELL: "Dell",
  ASUS: "ASUS",
  GIGABYTE: "Gigabyte",
  GIGABIT: "Gigabyte",
  INTEL: "Intel",
  BIOSTAR: "Biostar",
  TOSHIBA: "Toshiba",
  COMPAQ: "Compaq",
  KYOCERA: "Kyocera",
  EPSON: "Epson",
  CANON: "Canon",
  "D-LINK": "D-Link",
  DLINK: "D-Link",
  MIKROTIK: "MikroTik",
  HIKVISION: "Hikvision",
  DAHUA: "Dahua",
  BTICINO: "BTicino",
  AMVIZ: "Amviz",
};
const BRAND_KEYS = Object.keys(BRANDS).sort((a, b) => b.length - a.length);

/** "LENOVO MT_82YY_V15 G4 ABP" -> { brand: "Lenovo", model: "MT_82YY_V15 G4 ABP" }. */
function splitBrand(raw: string): { brand?: string; model?: string } {
  const s = clean(raw).replace(/^LAPTOP\s+/i, "");
  if (!s) return {};
  const upper = norm(s);
  for (const key of BRAND_KEYS) {
    if (upper === key || new RegExp(`^${key}[\\s_-]`).test(upper)) {
      const model = s.slice(key.length).replace(/^[\s_-]+/, "").trim();
      return { brand: BRANDS[key], model: model || undefined };
    }
  }
  if (upper === "EQUIPO ARMADO") return { model: "Equipo armado" };
  return { model: s };
}

function brandAnywhere(s: string): string | undefined {
  for (const word of norm(s).split(/\s+/)) if (BRANDS[word]) return BRANDS[word];
  return undefined;
}

/** Words that mark a "user" cell as a place, role or note rather than a person. */
const NOT_A_PERSON = new Set(
  ("VENTAS SALA CAPACITACIONES PASANTE CONVENIOS RECEPCION SCANEOS CONTABILIDAD SISTEMAS CUSTODIO " +
    "COBRANZAS COBRANZA CAJA PLANTA BAJA ASISTENTE CONTABLE SIN USUARIO QUITO ADMINISTRATIVO " +
    "LIQUIDACIONES BODEGA LIBRE IMPRESORA ANTES DANADO DANADA").split(" "),
);

/** Returns a display name when the cell names a person ("DR PATRICIO PINTADO" -> "Patricio Pintado"). */
function personName(raw: string): string | undefined {
  const s = clean(raw.split("/")[0]).replace(/^(DR|DRA|ING|ECO|LCDO|LCDA)\.?\s+/i, "");
  const tokens = norm(s).split(" ").filter(Boolean);
  if (tokens.length < 2 || tokens.some((t) => NOT_A_PERSON.has(t) || /\d/.test(t))) return undefined;
  return title(s);
}

/** First initial + surname: "Nioska Lavayen" -> nlavayen@, "Ana Veronica Alcivar" -> aalcivar@. */
function baseEmail(name: string): string {
  const t = norm(name).toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(Boolean);
  const surname = t.length === 2 ? t[1] : t[2];
  return `${t[0][0]}${surname}@${EMAIL_DOMAIN}`;
}

const nameTokens = (name: string) => new Set(norm(name).split(" "));
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));

class People {
  private byEmail = new Map<string, { name: string; rows: number[] }>();
  warnings: string[] = [];

  /** Registers a person and returns their email. "Ana Alcivar" and "Ana Veronica Alcivar" merge. */
  add(name: string, row: number): string {
    const base = baseEmail(name);
    for (let n = 1; ; n++) {
      const email = n === 1 ? base : base.replace("@", `${n}@`);
      const existing = this.byEmail.get(email);
      if (!existing) {
        this.byEmail.set(email, { name, rows: [row] });
        if (n > 1) this.warnings.push(`Row ${row}: "${name}" would get ${base}, already used; using ${email}`);
        return email;
      }
      const a = nameTokens(name);
      const b = nameTokens(existing.name);
      if (isSubset(a, b) || isSubset(b, a)) {
        if (a.size > b.size) existing.name = name;
        existing.rows.push(row);
        return email;
      }
    }
  }

  get list() {
    return [...this.byEmail].map(([email, p]) => ({ email, ...p }));
  }
}

// ---------------------------------------------------------------------------------------------
// Row parsing

type CategoryName = "Laptop" | "Desktop" | "Printer" | "Scanner" | "Networking" | "Security" | "Peripheral";

const TAG_PREFIX: Record<CategoryName, string> = {
  Laptop: "LT",
  Desktop: "DT",
  Printer: "PRN",
  Scanner: "SCN",
  Networking: "NET",
  Security: "SEC",
  Peripheral: "PER",
};

interface ParsedItem {
  row: number;
  category: CategoryName;
  brand?: string;
  model?: string;
  serialNumber?: string;
  description: string;
  notes: string[];
  status: ItemStatus;
  personEmail?: string;
  jobTitle?: string;
  location?: string;
  /** Reason recorded on the STATUS_CHANGED event for items that aren't assigned. */
  statusNote?: string;
}

type Section =
  | { kind: "computers"; city: string }
  | { kind: "contractPrinters" }
  | { kind: "scanners" }
  | { kind: "licences" }
  | { kind: "retired" }
  | { kind: "damagedPrinters" }
  | { kind: "misc" };

function sectionFromTitle(text: string, row: number): Section {
  const t = norm(text);
  if (CITIES[t]) return { kind: "computers", city: CITIES[t] };
  if (t.startsWith("IMPRESORAS CONTRATO")) return { kind: "contractPrinters" };
  if (t.startsWith("ESCANER")) return { kind: "scanners" };
  if (t.startsWith("EQUIPOS QUE SE DIERON DE BAJA")) return { kind: "retired" };
  if (t.startsWith("IMPRESORAS DANADAS")) return { kind: "damagedPrinters" };
  if (t.startsWith("EQUIPOS VARIOS")) return { kind: "misc" };
  throw new Error(`Row ${row}: unknown section title "${text}". Update import-inventory.ts for it.`);
}

type Cells = (col: number) => string;

class Importer {
  items: ParsedItem[] = [];
  skipped: string[] = [];
  people = new People();
  private computerKeys = new Map<string, ParsedItem>();

  /** Main office, branch and retired sections share the computer column layout. */
  computerRow(c: Cells, row: number, section: { city: string } | "retired") {
    const dept = c(2);
    const kind = norm(dept);
    const retired = section === "retired";
    const sectionCity = retired ? MAIN_CITY : section.city;

    if (/^(SUCURSALES|IP PUBLICA)/.test(kind)) {
      this.skipped.push(`Row ${row}: "${clean(dept)}" is a branch line / internet link, not a device`);
      return;
    }
    if (/^(IMPRESORA|BIOMETRICO|DVR|GRABADOR|ROUTER)/.test(kind)) return this.deviceRow(c, row, sectionCity);

    const user = c(4);
    const key = `${norm(user)}|${norm(c(17))}|${norm(c(18))}`;
    const dup = !retired && this.computerKeys.get(key);
    if (dup) {
      // Branch sections repeat some laptops from the main list; keep one and fill its gaps.
      const job = withoutCity(dept);
      if (dup.personEmail && !dup.jobTitle && job) dup.jobTitle = title(job);
      this.skipped.push(`Row ${row}: same computer as row ${dup.row} (${clean(user)}), merged`);
      return;
    }

    const type = norm(c(3));
    const laptop =
      type === "LAPTOP" ||
      (type !== "DESKTOP" && /IDEA|NOTEBOOK|LATITUDE|PROBOOK|SATELIT|THINKPAD|LAPTOP/.test(norm(c(17))));
    const { brand, model } = splitBrand(c(17));
    const cpu = clean(c(18));
    const ram = clean(c(19));
    const disk = clean(c(21));

    const notes: string[] = [];
    const ip = ipv4(c(5));
    if (ip) notes.push(`IP: ${ip}`);
    const ad = anyDesk(c(11));
    if (ad) notes.push(`AnyDesk: ${ad}`);
    if (/^WIN/i.test(c(13))) notes.push(`SO: ${clean(c(13))}`);
    if (/^\d{4}$/.test(clean(c(15)))) notes.push(`Office: ${clean(c(15))}`);
    if (c(20) && !looksSensitive(c(20))) notes.push(`Mainboard: ${clean(c(20))}`);
    if (c(22) && !looksSensitive(c(22))) notes.push(`${laptop ? "Pantalla / ref." : "Monitor"}: ${clean(c(22))}`);
    if (c(23)) notes.push(`UPS / regulador: ${clean(c(23))}`);
    if (c(24) && !/^\d{4}-\d{2}-\d{2}$/.test(c(24))) notes.push(`Unidad óptica: ${clean(c(24))}`);
    if (norm(c(8)) === "INSTALADO") notes.push("Antivirus: instalado");
    if (["VIP", "BLOQUEADO"].includes(norm(c(9)))) notes.push(`WhatsApp: ${title(c(9))}`);
    if (norm(c(9)) === "IP REPETIDA") notes.push("Obs.: IP repetida");
    if (c(25) && !looksSensitive(c(25))) notes.push(`Obs.: ${clean(c(25))}`);

    const item: ParsedItem = {
      row,
      category: laptop ? "Laptop" : "Desktop",
      brand,
      model,
      description: [cpu, ram && `${ram} RAM`, disk && `Disco ${disk}`].filter(Boolean).join(" · ") || (laptop ? "Laptop" : "Desktop"),
      notes,
      status: retired ? "RETIRED" : "IN_USE",
    };

    const city = cityIn(dept) ?? sectionCity;
    const area = withoutCity(dept) ? title(withoutCity(dept)) : undefined;
    const name = retired ? undefined : personName(user);
    if (retired) {
      if (area) notes.unshift(`Departamento: ${area}`);
      if (clean(user) && !isDamaged(user)) notes.unshift(`Último usuario: ${title(user)}`);
      item.statusNote = "Dado de baja";
    } else if (name) {
      item.personEmail = this.people.add(name, row);
      item.jobTitle = area;
      item.location = city;
    } else {
      item.location = area ? `${city} - ${area}` : city;
      if (clean(user)) notes.unshift(`Usuario en Excel: ${title(user)}`);
      item.statusNote = "Equipo compartido (sin persona asignada)";
    }

    if (!retired) this.computerKeys.set(key, item);
    this.items.push(item);
  }

  /** Printers, routers, DVRs and biometric readers listed inside the branch sections. */
  deviceRow(c: Cells, row: number, city: string) {
    const dept = clean(c(2));
    const kind = norm(dept);
    const label = looksSensitive(c(4)) ? "" : clean(c(4));
    const category: CategoryName = kind.startsWith("IMPRESORA") ? "Printer" : kind.startsWith("ROUTER") ? "Networking" : "Security";

    let brand: string | undefined;
    let model: string | undefined;
    const fromLabel = splitBrand(label);
    if (fromLabel.brand) {
      brand = fromLabel.brand;
      if (fromLabel.model && /\d/.test(fromLabel.model)) model = fromLabel.model;
    } else {
      brand = brandAnywhere(dept);
      if (label && /\d/.test(label) && category !== "Printer") model = label;
    }

    const notes: string[] = [];
    const ip = ipv4(c(5));
    if (ip) notes.push(`IP: ${ip}`);
    if (norm(c(9)) === "OUTSURCING") notes.push("Outsourcing");
    if (label && !fromLabel.brand && !model) notes.push(`Detalle: ${title(label)}`);

    this.items.push({
      row,
      category,
      brand,
      model,
      description: title(dept).replace(/^Biometrico/, "Biométrico"),
      notes,
      status: "IN_USE",
      location: city,
      statusNote: "Equipo de red / oficina (sin persona asignada)",
    });
  }

  contractPrinterRow(c: Cells, row: number) {
    const { brand, model } = splitBrand(c(4));
    const area = clean(c(11));
    const city = cityIn(area);
    const damaged = [c(3), c(11), c(13)].some(isDamaged);
    const contract = /CONTRATO/.test(norm(c(12))) || norm(c(17)) === "CONTRATO";

    const notes: string[] = [contract ? `Alquilada: ${title(c(12)).replace(/^Impresora /, "")}` : "Propia (fuera de contrato)"];
    const ip = ipv4(c(5));
    if (ip) notes.push(`IP: ${ip}`);
    if (norm(c(9)) === "OUTSURCING") notes.push("Outsourcing");
    const contact = clean(c(13));
    if (contact && !isDamaged(contact) && !looksSensitive(contact)) notes.push(`Contacto: ${title(contact)}`);
    const ref = clean(c(17)).replace(/^\\\\|\\$/g, "");
    if (ref && norm(ref) !== "CONTRATO" && !looksSensitive(ref)) notes.push(`Ref.: ${ref}`);
    if (damaged) notes.push("Dañada");

    this.items.push({
      row,
      category: "Printer",
      brand,
      model,
      description: contract ? `Impresora alquilada (${title(c(12)).replace(/^Impresora /, "").toLowerCase()})` : "Impresora",
      notes,
      status: damaged ? "IN_REPAIR" : "IN_USE",
      location: city ?? (area && !isDamaged(area) ? `${MAIN_CITY} - ${title(area)}` : MAIN_CITY),
      statusNote: damaged ? "Dañada" : "Impresora de área (sin persona asignada)",
    });
  }

  scannerRow(c: Cells, row: number) {
    const { brand, model } = splitBrand(c(2));
    const city = cityIn(c(11)) ?? MAIN_CITY;
    const maintenance = clean(c(3));
    const notes: string[] = [];
    if (/^REQUER/.test(norm(maintenance))) notes.push("Requiere mantenimiento");
    else if (maintenance) notes.push(`Mantenimiento: ${maintenance}`);

    const item: ParsedItem = { row, category: "Scanner", brand, model, description: "Escáner", notes, status: "IN_USE" };
    const name = personName(c(4));
    if (name) {
      item.personEmail = this.people.add(name, row);
      item.location = city;
    } else {
      item.location = c(4) ? `${city} - ${title(c(4))}` : city;
      item.statusNote = "Equipo compartido (sin persona asignada)";
    }
    this.items.push(item);
  }

  damagedPrinterRow(c: Cells, row: number) {
    const { brand, model } = splitBrand(c(3).replace(/\s*-\s*/g, " "));
    const area = clean(c(2).replace(/^IMPRESORA\s*-?\s*/i, ""));
    const notes = [`Área: ${title(area)}`];
    const ip = ipv4(c(4));
    if (ip) notes.push(`IP: ${ip}`);
    notes.push("Dañada");
    this.items.push({ row, category: "Printer", brand, model, description: "Impresora", notes, status: "RETIRED", statusNote: "Impresora dañada, dada de baja" });
  }

  miscRow(c: Cells, row: number, seenSerials: Map<string, number>) {
    let name = clean(c(2)).replace(/^SWICH\b/i, "SWITCH");
    const notes: string[] = [];
    const qty = name.match(/^(\d+)\s+(.*)$/);
    if (qty) {
      notes.push(`Cantidad: ${qty[1]}`);
      name = qty[2];
    }
    const n = norm(name);
    const category: CategoryName = /^(SWITCH|ROUTER)/.test(n)
      ? "Networking"
      : /^(CAMARA|DETECTOR|VIDEOPORTERO)/.test(n)
        ? "Security"
        : "Peripheral";

    const brand = brandAnywhere(name);
    const detail = clean(c(3));
    const model =
      detail && norm(detail) !== "SN" && /\d/.test(detail)
        ? (brand && splitBrand(detail).brand === brand ? splitBrand(detail).model : detail) // "HP 1410-24" -> "1410-24"
        : undefined;
    if (detail && norm(detail) !== "SN" && !model) notes.push(`Detalle: ${title(detail)}`);

    let serialNumber = c(4).match(/S\/N:\s*(.+)/i)?.[1]?.trim();
    if (serialNumber) {
      const first = seenSerials.get(serialNumber);
      if (first) {
        notes.push(`S/N en Excel (repetido con fila ${first}): ${serialNumber}`);
        this.people.warnings.push(`Row ${row}: serial ${serialNumber} already used by row ${first}; left blank`);
        serialNumber = undefined;
      } else seenSerials.set(serialNumber, row);
    }

    this.items.push({
      row,
      category,
      brand,
      model,
      serialNumber,
      description: title(name).replace(/\bDlink\b/, "D-Link"),
      notes,
      status: "IN_STORAGE",
    });
  }
}

async function parseWorkbook(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("The workbook has no sheets");

  const imp = new Importer();
  const seenSerials = new Map<string, number>();
  let section: Section = { kind: "computers", city: MAIN_CITY };

  ws.eachRow((r, row) => {
    const c: Cells = (col) => clean(cellText(r.getCell(col).value));
    if (row === 1) return; // column headers

    // Section titles are merged cells, so the same text repeats across the row, and they have
    // no item number (unlike data rows such as "VENTAS | VENTAS | VENTAS").
    const isTitle = (!c(1) && c(2) && c(2) === c(3) && c(3) === c(4)) || (c(1) && c(1) === c(2) && c(2) === c(3));
    if (isTitle) {
      section = sectionFromTitle(c(2), row);
      return;
    }
    if (norm(c(2)) === "LICENCIA" && norm(c(3)) === "DETALLE") {
      section = { kind: "licences" };
      return;
    }
    if (!c(2) && !c(3) && !c(4)) {
      if (c(1)) imp.skipped.push(`Row ${row}: only an item number, no data`);
      return;
    }

    switch (section.kind) {
      case "computers":
        return imp.computerRow(c, row, section);
      case "retired":
        return imp.computerRow(c, row, "retired");
      case "contractPrinters":
        return imp.contractPrinterRow(c, row);
      case "scanners":
        if (norm(c(2)) === "EQUIPO") return; // sub-header
        return imp.scannerRow(c, row);
      case "licences":
        imp.skipped.push(`Row ${row}: software licence "${c(2)}", not hardware`);
        return;
      case "damagedPrinters":
        return imp.damagedPrinterRow(c, row);
      case "misc":
        return imp.miscRow(c, row, seenSerials);
    }
  });

  return imp;
}

// ---------------------------------------------------------------------------------------------
// Database

const LIMITS = { brand: 100, model: 100, jobTitle: 100, location: 100, description: 500, notes: 1000 } as const;

function clip(item: ParsedItem, warnings: string[]) {
  const fit = (field: keyof typeof LIMITS, v: string | undefined) => {
    if (!v || v.length <= LIMITS[field]) return v;
    warnings.push(`Row ${item.row}: ${field} cut to ${LIMITS[field]} characters`);
    return v.slice(0, LIMITS[field]);
  };
  return {
    brand: fit("brand", item.brand) ?? null,
    model: fit("model", item.model) ?? null,
    jobTitle: fit("jobTitle", item.jobTitle) ?? null,
    location: fit("location", item.location) ?? null,
    description: fit("description", item.description)!,
    notes: fit("notes", item.notes.join("\n")) || null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error('Usage: npm run db:import -- "C:\\path\\INVENTARIO SISTEMAS.xlsx" [--dry-run]');
    process.exit(1);
  }

  const imp = await parseWorkbook(file);
  const db = new PrismaClient();
  try {
    const warnings = [...imp.people.warnings];

    const already = await db.itemEvent.count({ where: { notes: { startsWith: IMPORT_MARKER } } });
    if (already > 0) {
      throw new Error(`This database already has imported items (${already} events). Run "npm run db:reset" to start over.`);
    }
    const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error('No ADMIN user found. Run "npm run db:seed" first.');

    // Serial numbers must be unique across the whole table.
    const serials = imp.items.flatMap((i) => (i.serialNumber ? [i.serialNumber] : []));
    const taken = new Set(
      (await db.item.findMany({ where: { serialNumber: { in: serials } }, select: { serialNumber: true } })).map((i) => i.serialNumber),
    );
    for (const item of imp.items) {
      if (item.serialNumber && taken.has(item.serialNumber)) {
        warnings.push(`Row ${item.row}: serial ${item.serialNumber} already exists in the database; left blank`);
        item.notes.push(`S/N en Excel: ${item.serialNumber}`);
        item.serialNumber = undefined;
      }
    }

    // Asset tags continue after the highest existing number for each prefix (LT-0007 -> LT-0008).
    const next: Record<string, number> = {};
    for (const prefix of Object.values(TAG_PREFIX)) {
      const tags = await db.item.findMany({ where: { assetTag: { startsWith: `${prefix}-` } }, select: { assetTag: true } });
      next[prefix] = Math.max(0, ...tags.map((t) => Number(t.assetTag.slice(prefix.length + 1)) || 0)) + 1;
    }
    const rows = imp.items.map((item) => {
      const prefix = TAG_PREFIX[item.category];
      return { item, assetTag: `${prefix}-${String(next[prefix]++).padStart(4, "0")}`, fields: clip(item, warnings) };
    });

    const existingPeople = new Set(
      (await db.person.findMany({ where: { email: { in: imp.people.list.map((p) => p.email) } }, select: { email: true } })).map((p) => p.email),
    );
    const people = imp.people.list;
    const existingCategories = new Set((await db.category.findMany({ select: { name: true } })).map((c) => c.name));
    const newCategories = [...new Set(imp.items.map((i) => i.category))].filter((c) => !existingCategories.has(c));

    report({ file, rows, people, existingPeople, newCategories, skipped: imp.skipped, warnings, dryRun });
    if (dryRun) return;

    const source = basename(file);
    const now = new Date();
    await db.$transaction(
      async (tx) => {
        const categoryIds: Record<string, string> = {};
        for (const name of new Set(imp.items.map((i) => i.category))) {
          categoryIds[name] = (await tx.category.upsert({ where: { name }, update: {}, create: { name } })).id;
        }
        const personIds: Record<string, string> = {};
        for (const p of people) {
          personIds[p.email] = (await tx.person.upsert({ where: { email: p.email }, update: {}, create: { name: p.name, email: p.email } })).id;
        }

        for (const { item, assetTag, fields } of rows) {
          const personId = item.personEmail ? personIds[item.personEmail] : undefined;
          const base = { occurredAt: now, createdById: admin.id };
          const purchased = { ...base, type: "PURCHASED" as const, notes: `${IMPORT_MARKER} ${source}, row ${item.row}`, toStatus: "IN_STORAGE" as const };

          await tx.item.create({
            data: {
              assetTag,
              serialNumber: item.serialNumber ?? null,
              categoryId: categoryIds[item.category],
              ...fields,
              jobTitle: personId ? fields.jobTitle : null,
              status: item.status,
              assigneeId: personId ?? null,
              events: {
                create: [
                  purchased,
                  ...(personId
                    ? [{ ...base, type: "ASSIGNED" as const, personId, jobTitle: fields.jobTitle, location: fields.location, fromStatus: "IN_STORAGE" as const, toStatus: "IN_USE" as const }]
                    : item.status !== "IN_STORAGE"
                      ? [{ ...base, type: "STATUS_CHANGED" as const, notes: item.statusNote ?? null, fromStatus: "IN_STORAGE" as const, toStatus: item.status }]
                      : []),
                ],
              },
            },
          });
        }
      },
      { timeout: 120_000 },
    );
    console.log(`\nImported ${rows.length} items and ${people.length - existingPeople.size} new people.`);
  } finally {
    await db.$disconnect();
  }
}

function report(r: {
  file: string;
  rows: { item: ParsedItem; assetTag: string; fields: ReturnType<typeof clip> }[];
  people: { email: string; name: string; rows: number[] }[];
  existingPeople: Set<string>;
  newCategories: string[];
  skipped: string[];
  warnings: string[];
  dryRun: boolean;
}) {
  const emailToName = new Map(r.people.map((p) => [p.email, p.name]));
  console.log(`\n${r.dryRun ? "DRY RUN (nothing written)" : "Importing"}: ${basename(r.file)}\n`);

  console.log("Items:");
  for (const { item, assetTag, fields } of r.rows) {
    const who = item.personEmail ? emailToName.get(item.personEmail) : "—";
    const what = [fields.brand, fields.model].filter(Boolean).join(" ") || fields.description;
    console.log(`  row ${String(item.row).padStart(3)}  ${assetTag.padEnd(8)} ${item.status.padEnd(10)} ${what.slice(0, 40).padEnd(40)}  ${String(who).slice(0, 24).padEnd(24)}  ${fields.location ?? ""}`);
  }

  const counts = new Map<string, number>();
  for (const { item } of r.rows) counts.set(`${item.category} / ${item.status}`, (counts.get(`${item.category} / ${item.status}`) ?? 0) + 1);
  console.log(`\nTotals (${r.rows.length} items):`);
  for (const [k, n] of [...counts].sort()) console.log(`  ${k.padEnd(28)} ${n}`);

  console.log(`\nPeople (${r.people.length}, ${r.existingPeople.size} already in the database):`);
  for (const p of r.people.sort((a, b) => a.email.localeCompare(b.email))) {
    console.log(`  ${p.email.padEnd(28)} ${p.name.padEnd(30)} rows ${p.rows.join(", ")}${r.existingPeople.has(p.email) ? "  (exists)" : ""}`);
  }
  if (r.newCategories.length) console.log(`\nNew categories: ${r.newCategories.join(", ")}`);
  console.log(`\nSkipped rows (${r.skipped.length}):`);
  for (const s of r.skipped) console.log(`  ${s}`);
  if (r.warnings.length) {
    console.log(`\nWarnings (${r.warnings.length}):`);
    for (const w of r.warnings) console.log(`  ${w}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
