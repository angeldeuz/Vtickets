import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { IdentityService } from "./identity.service";
import { JwtVerifierService } from "./jwt-verifier.service";
import type { AuthenticatedRequest } from "./principal";

// Guard: Nest lo ejecuta antes del controlador para impedir una operación sin identidad válida.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService, private readonly identity: IdentityService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.authorization ?? "");
    if (!match) throw new UnauthorizedException("Falta el token de acceso");
    const authUserId = await this.verifier.verify(match[1]);
    request.principal = await this.identity.resolve(authUserId);
    return true;
  }
}
