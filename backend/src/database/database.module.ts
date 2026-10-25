import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

// Global evita crear un pool nuevo en cada módulo del monolito.
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class DatabaseModule {}
