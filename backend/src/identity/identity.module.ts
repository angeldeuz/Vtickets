import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { IdentityController } from "./identity.controller";
import { IdentityService } from "./identity.service";
import { JwtVerifierService } from "./jwt-verifier.service";
import { RolesGuard } from "./roles.guard";

@Module({
  controllers: [IdentityController],
  providers: [JwtVerifierService, IdentityService, AuthGuard, RolesGuard],
  exports: [JwtVerifierService, IdentityService, AuthGuard, RolesGuard],
})
export class IdentityModule {}
