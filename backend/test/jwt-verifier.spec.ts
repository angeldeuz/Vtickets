import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { ConfigService } from "@nestjs/config";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { JwtVerifierService } from "../src/identity/jwt-verifier.service";

describe("verificación JWT de Supabase", () => {
  let server: Server;
  let verifier: JwtVerifierService;
  let issuer: string;
  let validToken: string;
  let expiredToken: string;
  let wrongAudienceToken: string;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair("ES256");
    const jwk = await exportJWK(publicKey);
    server = createServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ keys: [{ ...jwk, kid: "test-key", alg: "ES256", use: "sig" }] }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}`;
    issuer = `${url}/auth/v1`;
    verifier = new JwtVerifierService({ get: () => url } as unknown as ConfigService);
    validToken = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer(issuer).setAudience("authenticated")
      .setSubject("cd2b9a60-4b5a-40b1-88ad-d1bd73ba7e2a")
      .setExpirationTime("5m").sign(privateKey);
    expiredToken = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer(issuer).setAudience("authenticated")
      .setSubject("cd2b9a60-4b5a-40b1-88ad-d1bd73ba7e2a")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300).sign(privateKey);
    wrongAudienceToken = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setIssuer(issuer).setAudience("otro-servicio")
      .setSubject("cd2b9a60-4b5a-40b1-88ad-d1bd73ba7e2a")
      .setExpirationTime("5m").sign(privateKey);
  });

  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

  it("acepta una firma válida del JWKS del proyecto", async () => {
    await expect(verifier.verify(validToken)).resolves.toBe("cd2b9a60-4b5a-40b1-88ad-d1bd73ba7e2a");
  });

  it("rechaza un token alterado aunque conserve sus claims", async () => {
    const parts = validToken.split(".");
    parts[1] = parts[1].slice(0, -1) + (parts[1].at(-1) === "A" ? "B" : "A");
    await expect(verifier.verify(parts.join("."))).rejects.toMatchObject({ status: 401 });
  });

  it("rechaza un token cuya expiración ya pasó", async () => {
    await expect(verifier.verify(expiredToken)).rejects.toMatchObject({ status: 401 });
  });

  it("rechaza un token firmado para otra audiencia", async () => {
    await expect(verifier.verify(wrongAudienceToken)).rejects.toMatchObject({ status: 401 });
  });
});
