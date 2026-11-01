import { PrismaService } from "../src/database/prisma.service";
import { EventStaffService } from "../src/events/event-staff.service";

const id = "4e8620a3-cdc3-45e9-a1e1-0dc5b75d8de9";
const assignment = { id, eventId: id, userId: id, roleId: id, status: "assigned", startsAt: null, endsAt: null };

describe("personal autorizado F04-T06", () => {
  let service: EventStaffService;
  let writes: unknown[];
  let audit: unknown[];
  let active = true;
  beforeEach(() => {
    writes = []; audit = []; active = true;
    const tx = {
      evento: { findUnique: async () => ({ status: "published" }) },
      usuario: { findUnique: async () => ({ status: active ? "active" : "blocked" }) },
      rol: { findUnique: async () => ({ id }) },
      personalEvento: {
        findUnique: async () => null, findFirst: async () => assignment,
        create: async (data: unknown) => { writes.push(data); return assignment; },
        update: async ({ data }: { data: { status: string } }) => { writes.push(data); return { ...assignment, status: data.status }; },
      },
      auditoria: { create: async (data: unknown) => { audit.push(data); } },
    };
    service = new EventStaffService({ client: { $transaction: async (fn: (value: any) => Promise<unknown>) => fn(tx) } } as unknown as PrismaService);
  });

  it("asigna ACCESO y audita el cambio", async () => {
    await service.create(id, { userId: id, roleCode: "ACCESO" }, id);
    expect(writes).toHaveLength(1);
    expect(audit[0]).toMatchObject({ data: { action: "staff.assigned", actorUserId: id } });
  });

  it("impide asignar usuarios inactivos y ventanas inválidas", async () => {
    active = false;
    await expect(service.create(id, { userId: id, roleCode: "ACCESO" }, id))
      .rejects.toMatchObject({ response: { code: "INVALID_STAFF_USER" } });
    await expect(service.create(id, { userId: id, roleCode: "ACCESO", startsAt: "2030-01-02T00:00:00Z", endsAt: "2030-01-01T00:00:00Z" }, id))
      .rejects.toMatchObject({ response: { code: "INVALID_STAFF_WINDOW" } });
    expect(writes).toHaveLength(0);
  });

  it("retira acceso y registra el estado anterior", async () => {
    await service.update(id, id, { status: "withdrawn" }, id);
    expect(writes).toHaveLength(1);
    expect(audit[0]).toMatchObject({ data: { action: "staff.withdrawn", metadata: { before: { status: "assigned" } } } });
  });
});
