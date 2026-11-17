import { describe, expect, it, vi } from "vitest";
import { assignSchema, itemSchema, personSchema } from "./validation";

// authz imports the Auth.js config; only the pure check is under test here.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
const { assertAdmin, AuthzError } = await import("./authz");

describe("itemSchema", () => {
  it("parses form strings: empty optional fields become undefined, price becomes cents", () => {
    const r = itemSchema.parse({
      assetTag: " LT-1 ",
      categoryId: "c1",
      description: "Laptop",
      serialNumber: "",
      purchasePrice: "1299.5",
      purchasedAt: "2026-01-10",
    });
    expect(r.assetTag).toBe("LT-1");
    expect(r.serialNumber).toBeUndefined();
    expect(r.purchasePrice).toBe(129950);
    expect(r.purchasedAt?.getDate()).toBe(10);
  });

  it("rejects missing required fields and bad values", () => {
    const r = itemSchema.safeParse({ assetTag: "", categoryId: "", description: "x", purchasePrice: "abc", purchasedAt: "10/01/2026" });
    expect(r.success).toBe(false);
    const errs = r.error!.flatten().fieldErrors;
    expect(Object.keys(errs).sort()).toEqual(["assetTag", "categoryId", "purchasePrice", "purchasedAt"]);
    // Messages are translation keys, resolved per user language in runAction.
    expect(errs).toMatchObject({
      assetTag: ["required"],
      categoryId: ["required"],
      purchasePrice: ["invalidAmount"],
      purchasedAt: ["invalidDate"],
    });
  });
});

describe("assignSchema / personSchema", () => {
  it("requires a person and a date", () => {
    expect(assignSchema.safeParse({ personId: "", occurredAt: "" }).success).toBe(false);
  });
  it("lower-cases emails and rejects invalid ones", () => {
    expect(personSchema.parse({ name: "Ana", email: "Ana@X.com" }).email).toBe("ana@x.com");
    const bad = personSchema.safeParse({ name: "Ana", email: "nope" });
    expect(bad.success).toBe(false);
    expect(bad.error!.flatten().fieldErrors.email).toEqual(["invalidEmail"]);
  });
});

describe("assertAdmin", () => {
  it("allows admins and rejects viewers and anonymous users", () => {
    expect(() => assertAdmin({ role: "ADMIN" })).not.toThrow();
    expect(() => assertAdmin({ role: "VIEWER" })).toThrow(AuthzError);
    expect(() => assertAdmin({ role: "VIEWER" })).toThrow(expect.objectContaining({ code: "adminOnly" }));
    expect(() => assertAdmin(null)).toThrow(expect.objectContaining({ code: "notSignedIn" }));
  });
});
