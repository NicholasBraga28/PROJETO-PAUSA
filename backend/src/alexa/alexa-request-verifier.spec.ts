import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "@nestjs/common";
import { SkillRequestSignatureVerifier } from "ask-sdk-express-adapter";
import { AskSdkAlexaRequestVerifier } from "./alexa-request-verifier";

let mockTrustedRoots: string[] = [];
jest.mock("tls", () => ({
  ...jest.requireActual<typeof import("tls")>("tls"),
  get rootCertificates() {
    return mockTrustedRoots;
  },
}));

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

const TEST_ROOT_CA = fixture("test-root-ca.pem");
const ECHO_API_CHAIN = fixture("echo-api-chain.pem");
const OTHER_DOMAIN_CHAIN = fixture("other-domain-chain.pem");
const SIGNING_KEY = fixture("signing-key.pem");
const CERT_CHAIN_URL = "https://s3.amazonaws.com/echo.api/echo-api-cert-12.pem";
const BODY = JSON.stringify({ version: "1.0", request: { type: "LaunchRequest", requestId: "req-1" } });

const signedHeaders = (body: string) => ({
  "signature-256": createSign("RSA-SHA256").update(body).sign(SIGNING_KEY, "base64"),
  signaturecertchainurl: CERT_CHAIN_URL,
});

const serveCertChain = (chain: string) =>
  jest
    .spyOn(
      SkillRequestSignatureVerifier.prototype as unknown as { _getCertChainByUrl(): Promise<string> },
      "_getCertChainByUrl",
    )
    .mockResolvedValue(chain);

describe("AskSdkAlexaRequestVerifier", () => {
  beforeEach(() => {
    mockTrustedRoots = [TEST_ROOT_CA];
    serveCertChain(ECHO_API_CHAIN);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("RNF-03: accepts a body signed by a trusted echo-api.amazon.com certificate", async () => {
    await expect(new AskSdkAlexaRequestVerifier().verify(BODY, signedHeaders(BODY))).resolves.toBe(true);
  });

  it("RNF-03: refuses a body changed after it was signed", async () => {
    const tampered = BODY.replace("LaunchRequest", "IntentRequest");

    await expect(new AskSdkAlexaRequestVerifier().verify(tampered, signedHeaders(BODY))).resolves.toBe(false);
  });

  it("RNF-03: refuses a request without the signature headers", async () => {
    await expect(new AskSdkAlexaRequestVerifier().verify(BODY, {})).resolves.toBe(false);
  });

  it("RNF-04: logs why the SDK refused the signature", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    await new AskSdkAlexaRequestVerifier().verify(BODY, {});

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Missing Certificate for the skill request"));
  });

  it("RNF-03: refuses a certificate issued for another domain", async () => {
    serveCertChain(OTHER_DOMAIN_CHAIN);

    await expect(new AskSdkAlexaRequestVerifier().verify(BODY, signedHeaders(BODY))).resolves.toBe(false);
  });

  it("RNF-03: refuses a certificate that does not chain to a trusted root", async () => {
    mockTrustedRoots = [];

    await expect(new AskSdkAlexaRequestVerifier().verify(BODY, signedHeaders(BODY))).resolves.toBe(false);
  });
});
