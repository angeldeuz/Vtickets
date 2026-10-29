import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";

describe("API básica", () => {
  let processApi: ChildProcess;
  let baseUrl: string;

  beforeAll(async () => {
    const port = await new Promise<number>((done) => {
      const server = createServer();
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const value = typeof address === "object" && address ? address.port : 0;
        server.close(() => done(value));
      });
    });
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
    processApi = spawn(process.execPath, [resolve(process.cwd(), "dist/src/main.js")], {
      cwd: process.cwd(),
      env: { ...process.env, API_PORT: String(port), DATABASE_URL: "" },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 60; attempt++) {
      if (processApi.exitCode !== null) throw new Error("La API terminó antes de responder");
      try { if ((await fetch(`${baseUrl}/health`)).ok) return; } catch { /* Arranque en curso. */ }
      await new Promise((done) => setTimeout(done, 100));
    }
    throw new Error("La API no arrancó en 6 segundos");
  }, 10_000);

  afterAll(() => { processApi?.kill(); });

  it("distingue proceso vivo de base no configurada", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    expect(health.headers.get("x-request-id")).toBeTruthy();

    const ready = await fetch(`${baseUrl}/ready`);
    expect(ready.status).toBe(503);
    const body = await ready.json() as { error: { code: string; stack?: string } };
    expect(body.error.code).toBe("UNAVAILABLE");
    expect(body.error.stack).toBeUndefined();
  });

  it("rechaza el perfil propio sin token", async () => {
    const response = await fetch(`${baseUrl}/me`);
    expect(response.status).toBe(401);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("limita las solicitudes repetidas a la API", async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 65; attempt++) {
      statuses.push((await fetch(`${baseUrl}/me`)).status);
    }
    expect(statuses).toContain(429);
  });
});
