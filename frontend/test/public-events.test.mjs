import assert from "node:assert/strict";
import test from "node:test";
import { formatMoney, getEvents } from "../src/lib/events.ts";

test("muestra los centavos de los precios publicados", () => {
  assert.match(formatMoney(250.5), /250\.50/);
});

test("envía filtros y cursor y consume una página sin descartar la siguiente", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return { ok: true, json: async () => ({ items: [{ id: "event-1" }], nextCursor: "pagina-2" }) };
  };
  try {
    const result = await getEvents({ limit: 20, q: "Jazz", category: "Música", cursor: "pagina-1" });
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get("q"), "Jazz");
    assert.equal(url.searchParams.get("category"), "Música");
    assert.equal(url.searchParams.get("cursor"), "pagina-1");
    assert.equal(result.events.length, 1);
    assert.equal(result.nextCursor, "pagina-2");
    assert.equal(result.error, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
