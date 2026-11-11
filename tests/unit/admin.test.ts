import { describe, expect, it } from "vitest";
import { adminErrorMessage, canManageStores, canModerate, isReportKind, isStaff } from "@/lib/admin/format";

describe("admin", () => {
  it("papéis da equipe", () => {
    expect(isStaff(["buyer", "seller"])).toBe(false);
    expect(isStaff(["buyer", "analyst"])).toBe(true);
    expect(canModerate(["moderator"])).toBe(true);
    expect(canModerate(["admin_finance"])).toBe(false);
    expect(canManageStores(["moderator"])).toBe(false);
    expect(canManageStores(["admin_ops"])).toBe(true);
  });
  it("tipos de denúncia", () => {
    expect(isReportKind("product")).toBe(true);
    expect(isReportKind("user")).toBe(false);
    expect(isReportKind(undefined)).toBe(false);
  });
  it("erros", () => {
    expect(adminErrorMessage("reason_required")).toMatch(/motivo/);
    expect(adminErrorMessage("forbidden")).toMatch(/papel/);
    expect(adminErrorMessage("already_reported")).toMatch(/já denunciou/);
  });
});
