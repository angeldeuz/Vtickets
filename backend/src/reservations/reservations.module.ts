import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { IdentityModule } from "../identity/identity.module";
import { ReservationsController } from "./reservations.controller";
import { ReservationsService } from "./reservations.service";
import { CheckoutService } from "./checkout.service";
import { PurchasesController } from "./purchases.controller";

@Module({ imports: [DatabaseModule, IdentityModule], controllers: [ReservationsController, PurchasesController], providers: [ReservationsService, CheckoutService], exports: [ReservationsService] })
export class ReservationsModule {}
