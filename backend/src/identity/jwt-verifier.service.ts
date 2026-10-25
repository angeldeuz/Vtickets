import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

// Supabase Auth firma el token; Nest solo verifica la firma y los claims, nunca emite sesiones.
@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  private readonly keys: JWTVerifyGetKey | null;

  constructor(config: ConfigService) {
    const url = config.get<string>("SUPABASE_URL") || "";
    this.issuer = url ? `${url.replace(/\/$/, "")}/auth/v1` : "";
    this.keys = this.issuer
      ? createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), { cacheMaxAge: 600_000 })
      : null;
  }

  async verify(token: string): Promise<string> {
    if (!this.keys) throw new ServiceUnavailableException("Supabase Auth no configurado");
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.issuer,
        audience: "authenticated",
        algorithms: ["ES256", "RS256"],
      });
      if (payload.role !== "authenticated" || !z.uuid().safeParse(payload.sub).success) {
        throw new UnauthorizedException("Token no válido");
      }
      return payload.sub!;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Token no válido o expirado");
    }
  }
}
