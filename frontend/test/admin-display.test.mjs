import assert from "node:assert/strict";
import test from "node:test";
import { collectPages } from "../src/lib/paginated-list.ts";
import { describeAudit } from "../src/lib/audit-display.ts";

test("el selector reúne elementos después de la primera página", async () => {
  const calls = [];
  const items = await collectPages(async (cursor) => {
    calls.push(cursor);
    return cursor ? { items: [101], nextCursor: null } :
      { items: Array.from({ length: 100 }, (_, index) => index + 1), nextCursor: "ultimo-de-la-primera" };
  });
  assert.equal(items.length, 101);
  assert.equal(items.at(-1), 101);
  assert.deepEqual(calls, [null, "ultimo-de-la-primera"]);
});

test("la auditoría conserva el nombre histórico del evento", () => {
  const entry = { action: "event.created", entityName: "evento", metadata: { title: "Festival A" },
    eventTitle: "Festival B", ticketName: null, subjectName: null };
  assert.equal(describeAudit(entry).label, "Festival A");
});

test("la auditoría explica cambios de nombre y condiciones del boleto", () => {
  const entry = { action: "ticket_type.updated", entityName: "tipo_ticket", metadata: {
    changedFields: ["name", "maxPerOrder", "salesStartsAt"],
    before: { name: "General", maxPerOrder: 4, salesStartsAt: null },
    after: { name: "Preferente", maxPerOrder: 2, salesStartsAt: "2030-10-01T10:00:00.000Z" },
  }, eventTitle: "Concierto", ticketName: "Nombre actual", subjectName: null };
  const view = describeAudit(entry);
  assert.equal(view.label, "Preferente");
  assert.ok(view.facts.some((fact) => fact.label === "Nombre" && fact.text === "General → Preferente"));
  assert.ok(view.facts.some((fact) => fact.label === "Máximo por compra" && fact.text === "4 → 2"));
  assert.ok(view.facts.some((fact) => fact.label === "Venta desde"));
});
