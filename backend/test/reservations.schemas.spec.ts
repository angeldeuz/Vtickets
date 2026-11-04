import { reservationCreateSchema } from "../src/reservations/reservations.schemas";

const eventId = "11111111-1111-4111-8111-111111111111";
const firstType = "22222222-2222-4222-8222-222222222222";
const secondType = "33333333-3333-4333-8333-333333333333";

describe("selección de entradas F06", () => {
  it("admite cantidades enteras dentro del límite aprobado", () => {
    expect(reservationCreateSchema.safeParse({ eventId, items: [
      { ticketTypeId: firstType, quantity: 3 }, { ticketTypeId: secondType, quantity: 1 },
    ] }).success).toBe(true);
  });

  it("rechaza duplicados y más de cuatro entradas entre tipos", () => {
    expect(reservationCreateSchema.safeParse({ eventId, items: [
      { ticketTypeId: firstType, quantity: 2 }, { ticketTypeId: firstType, quantity: 1 },
    ] }).success).toBe(false);
    expect(reservationCreateSchema.safeParse({ eventId, items: [
      { ticketTypeId: firstType, quantity: 3 }, { ticketTypeId: secondType, quantity: 2 },
    ] }).success).toBe(false);
  });

  it("rechaza cantidades fraccionarias, negativas y campos desconocidos", () => {
    for (const quantity of [0, -1, 1.5, 5]) {
      expect(reservationCreateSchema.safeParse({ eventId, items: [{ ticketTypeId: firstType, quantity }] }).success).toBe(false);
    }
    expect(reservationCreateSchema.safeParse({ eventId, customerId: eventId, items: [{ ticketTypeId: firstType, quantity: 1 }] }).success).toBe(false);
  });
});
