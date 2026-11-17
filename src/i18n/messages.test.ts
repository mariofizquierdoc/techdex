import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { LOCALES, MESSAGE_FILE } from "./config";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flatten(v, key) };
  }, {});
}

const catalogs = { es: flatten(es), en: flatten(en) };

/** Placeholder names in an ICU message, e.g. {name}, {count, plural, …}, <person>. */
function placeholders(msg: string): string[] {
  const args = [...msg.matchAll(/\{\s*(\w+)\s*[,}]/g)].map((m) => m[1]);
  const tags = [...msg.matchAll(/<(\w+)>/g)].map((m) => `<${m[1]}>`);
  return [...new Set([...args, ...tags])].sort();
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sourceFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

describe("message catalogs", () => {
  it("every locale has a catalog file", () => {
    for (const l of LOCALES) expect(Object.keys(catalogs)).toContain(MESSAGE_FILE[l]);
  });

  it("es and en have exactly the same keys", () => {
    expect(Object.keys(catalogs.en).sort()).toEqual(Object.keys(catalogs.es).sort());
  });

  it("no message is empty", () => {
    for (const [lang, msgs] of Object.entries(catalogs)) {
      for (const [key, value] of Object.entries(msgs)) {
        expect(value.trim(), `${lang}: ${key}`).not.toBe("");
      }
    }
  });

  it("translations use the same placeholders", () => {
    for (const [key, value] of Object.entries(catalogs.es)) {
      expect(placeholders(catalogs.en[key] ?? ""), key).toEqual(placeholders(value));
    }
  });

  it("every error code and validation key thrown in the code has a message", () => {
    const src = sourceFiles(join(__dirname, "..")).map((f) => readFileSync(f, "utf8")).join("\n");
    const errorCodes = [...src.matchAll(/new (?:Domain|Authz)Error\("(\w+)"/g)].map((m) => m[1]);
    const validationKeys = [...src.matchAll(/\bm\("(\w+)"\)/g)].map((m) => m[1]);
    expect(errorCodes.length).toBeGreaterThan(10);
    expect(validationKeys.length).toBeGreaterThan(3);
    for (const code of new Set(errorCodes)) expect(catalogs.es, code).toHaveProperty([`errors.${code}`]);
    for (const key of new Set([...validationKeys, "required", "invalid"])) {
      expect(catalogs.es, key).toHaveProperty([`validation.${key}`]);
    }
  });
});
