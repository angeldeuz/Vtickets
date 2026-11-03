import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { AdminEventImagesController } from "./event-images.controller";
import { EventImagesService } from "./event-images.service";
import { AdminEventsController } from "./events.controller";
import { EventsService } from "./events.service";
import { StorageService } from "./storage.service";
import { AdminTicketTypesController } from "./ticket-types.controller";
import { TicketTypesService } from "./ticket-types.service";
import { AdminEventStaffController } from "./event-staff.controller";
import { EventStaffService } from "./event-staff.service";
import { AdminAuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { PublicEventsController } from "./public-events.controller";
import { PublicEventsService } from "./public-events.service";

@Module({ imports: [IdentityModule], controllers: [AdminEventsController, AdminEventImagesController, AdminTicketTypesController, AdminEventStaffController, AdminAuditController, AdminUsersController, PublicEventsController], providers: [EventsService, EventImagesService, StorageService, TicketTypesService, EventStaffService, AuditService, AdminUsersService, PublicEventsService] })
export class EventsModule {}
