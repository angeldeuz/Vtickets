import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AdminCatalogController, PublicCategoriesController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({ imports: [IdentityModule], controllers: [PublicCategoriesController, AdminCatalogController], providers: [CatalogService] })
export class CatalogModule {}
