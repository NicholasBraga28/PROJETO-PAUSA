import { createHmac } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { AlexaRequestVerifier } from "../../src/alexa/alexa-request-verifier";

export const FAKE_CERT_CHAIN_URL = "https://s3.amazonaws.com/echo.api/fake-test-cert.pem";
const FAKE_SIGNING_KEY = "alexa-e2e-signing-key";

const fakeSignatureOf = (body: string) => createHmac("sha256", FAKE_SIGNING_KEY).update(body).digest("base64");

export type AlexaHeaders = Readonly<Record<string, string>>;

export class FakeAlexaRequestVerifier implements AlexaRequestVerifier {
  async verify(rawBody: string, headers: IncomingHttpHeaders): Promise<boolean> {
    return (
      headers["signature-256"] === fakeSignatureOf(rawBody) && headers["signaturecertchainurl"] === FAKE_CERT_CHAIN_URL
    );
  }
}

export const signedAlexaHeaders = (body: string): AlexaHeaders => ({
  "content-type": "application/json",
  "signature-256": fakeSignatureOf(body),
  signaturecertchainurl: FAKE_CERT_CHAIN_URL,
});
