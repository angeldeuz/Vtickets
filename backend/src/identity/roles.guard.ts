import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedRequest } from "./principal";

const ROLES_KEY = "vtickets.roles";
export const RequireRoles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Los roles se consultan en PostgreSQL en cada solicitud protegida, no en claims editables del JWT.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().principal;
    if (!principal || !required.some((role) => principal.roles.includes(role))) {
      throw new ForbiddenException("Rol insuficiente");
    }
    return true;
  }
}
