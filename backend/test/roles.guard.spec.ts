import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { RequireRoles, RolesGuard } from "../src/identity/roles.guard";
import type { AuthenticatedRequest, Principal } from "../src/identity/principal";

class ProtectedRoutes {
  @RequireRoles("ADMINISTRADOR")
  adminOnly() {}
}

function contextFor(principal: Principal | undefined): ExecutionContext {
  const request: AuthenticatedRequest = { headers: {}, principal };
  return {
    getHandler: () => ProtectedRoutes.prototype.adminOnly,
    getClass: () => ProtectedRoutes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("autorización por rol", () => {
  let guard: RolesGuard;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ providers: [RolesGuard, Reflector] }).compile();
    guard = module.get(RolesGuard);
  });

  const principal = (roles: string[]): Principal => ({
    authUserId: "cd2b9a60-4b5a-40b1-88ad-d1bd73ba7e2a",
    userId: "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9",
    roles,
  });

  it("rechaza al cliente en una operación administrativa", () => {
    expect(() => guard.canActivate(contextFor(principal(["CLIENTE"])))).toThrow(ForbiddenException);
  });

  it("permite al administrador en la misma operación", () => {
    expect(guard.canActivate(contextFor(principal(["CLIENTE", "ADMINISTRADOR"])))).toBe(true);
  });

  it("rechaza una solicitud sin perfil", () => {
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
  });
});
