import { INestApplication } from "@nestjs/common";
import type { RequestEnvelope } from "ask-sdk-model";
import * as request from "supertest";
import { FakeClock } from "../src/common/clock/fake-clock";
import { PrismaService } from "../src/prisma/prisma.service";
import { ALEXA_TEST_DEVICE_ID, intentRequest } from "./support/alexa-envelopes";
import { createTestApp } from "./support/create-test-app";
import { signedAlexaHeaders } from "./support/fake-alexa-request-verifier";
import { truncateAllTables } from "./support/test-database";

const NOW = new Date("2026-11-03T13:00:00Z");
const IN_ONE_HOUR = new Date("2026-11-03T14:00:00Z");
const OTHER_DEVICE_ID = "amzn1.ask.device.OTHER-DEVICE";
const PAIRED_TEXT = "Pronto. Esta Alexa agora atende Bruno.";
const PAIRED_SPEECH = `<speak>${PAIRED_TEXT}</speak>`;
const REJECTED_SPEECH = "<speak>Código inválido ou expirado. Peça um novo código ao RH.</speak>";

describe("Alexa device pairing by voice (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let hrId: string;
  let brunoId: string;
  const clock = new FakeClock(NOW);

  const send = (envelope: RequestEnvelope) => {
    const body = JSON.stringify(envelope);
    return request(app.getHttpServer()).post("/api/alexa").set(signedAlexaHeaders(body)).send(body);
  };
  const sayCode = (code: string, deviceId = ALEXA_TEST_DEVICE_ID) =>
    send(intentRequest("PairDeviceIntent", { timestamp: clock.now(), deviceId, slots: { code } }));
  const speechOf = (response: request.Response): string => response.body.response.outputSpeech.ssml;

  const createTherapist = async (email: string, name: string) => {
    const user = await prisma.user.create({ data: { email, name, role: "THERAPIST" } });
    return (await prisma.therapist.create({ data: { userId: user.id } })).id;
  };
  const createCode = (code: string, therapistId: string, expiresAt = IN_ONE_HOUR) =>
    prisma.alexaPairingCode.create({ data: { code, therapistId, createdById: hrId, expiresAt } });
  const linkedTherapistIdsOf = async (deviceId: string) =>
    (await prisma.alexaDeviceTherapist.findMany({ where: { alexaDevice: { deviceId } } }))
      .map(({ therapistId }) => therapistId)
      .sort();

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp({ clock }));
  });

  beforeEach(async () => {
    clock.set(NOW);
    await truncateAllTables(prisma);
    hrId = (await prisma.user.create({ data: { email: "hr@example.com", name: "Helena Rocha", role: "HR" } })).id;
    brunoId = await createTherapist("bruno@example.com", "Bruno Lima");
  });

  afterAll(async () => {
    await app.close();
  });

  it("RF-17: pairs a new device, consumes the code, audits it and names the therapist", async () => {
    const pairingCode = await createCode("482913", brunoId);

    const response = await sayCode("482913").expect(200);

    expect(speechOf(response)).toBe(PAIRED_SPEECH);
    const device = await prisma.alexaDevice.findUniqueOrThrow({ where: { deviceId: ALEXA_TEST_DEVICE_ID } });
    expect(await linkedTherapistIdsOf(ALEXA_TEST_DEVICE_ID)).toEqual([brunoId]);
    expect(await prisma.alexaPairingCode.findUniqueOrThrow({ where: { id: pairingCode.id } })).toEqual(
      expect.objectContaining({ consumedAt: NOW, consumedByDeviceId: device.id }),
    );
    const brunoUserId = (await prisma.therapist.findUniqueOrThrow({ where: { id: brunoId } })).userId;
    const audits = await prisma.auditEvent.findMany({ where: { action: "ALEXA_DEVICE_PAIRED" } });
    expect(audits).toEqual([
      expect.objectContaining({
        actorId: brunoUserId,
        entityType: "AlexaDevice",
        entityId: device.id,
        data: { alexaDeviceId: device.id, pairingCodeId: pairingCode.id, therapistId: brunoId },
      }),
    ]);
    expect(JSON.stringify(audits)).not.toContain("482913");
  });

  it("D-18 RF-17: pairs with a code whose leading zero the number slot dropped", async () => {
    await createCode("048213", brunoId);

    const response = await sayCode("48213").expect(200);

    expect(speechOf(response)).toBe(PAIRED_SPEECH);
    expect(await linkedTherapistIdsOf(ALEXA_TEST_DEVICE_ID)).toEqual([brunoId]);
  });

  it("RF-17: keeps the therapist who just paired identified for the rest of the conversation", async () => {
    await createCode("482913", brunoId);

    const response = await sayCode("482913").expect(200);

    expect(response.body.sessionAttributes).toEqual({ speakerTherapistId: brunoId, lastSpeech: PAIRED_TEXT });
    expect(response.body.response.shouldEndSession).toBe(false);
  });

  describe("refusals", () => {
    const expectNothingChanged = async () => {
      expect(await prisma.alexaDevice.count()).toBe(0);
      expect(await prisma.auditEvent.count({ where: { action: "ALEXA_DEVICE_PAIRED" } })).toBe(0);
    };

    it("RF-17: refuses a code that does not exist", async () => {
      await createCode("482913", brunoId);

      const response = await sayCode("111111").expect(200);

      expect(speechOf(response)).toBe(REJECTED_SPEECH);
      expect(response.body.response.shouldEndSession).toBe(true);
      await expectNothingChanged();
    });

    it("RF-17: refuses a code expired by the clock", async () => {
      await createCode("482913", brunoId);
      clock.set(IN_ONE_HOUR);

      const response = await sayCode("482913").expect(200);

      expect(speechOf(response)).toBe(REJECTED_SPEECH);
      await expectNothingChanged();
    });

    it("RF-17: refuses a code that was already used", async () => {
      await createCode("482913", brunoId);
      await sayCode("482913", OTHER_DEVICE_ID).expect(200);

      const response = await sayCode("482913").expect(200);

      expect(speechOf(response)).toBe(REJECTED_SPEECH);
      expect(await prisma.alexaDevice.findUnique({ where: { deviceId: ALEXA_TEST_DEVICE_ID } })).toBeNull();
    });

    it("RF-17: refuses the code of an inactive therapist", async () => {
      await createCode("482913", brunoId);
      await prisma.user.updateMany({ where: { role: "THERAPIST" }, data: { status: "INACTIVE" } });

      const response = await sayCode("482913").expect(200);

      expect(speechOf(response)).toBe(REJECTED_SPEECH);
      await expectNothingChanged();
    });

    it("D-18 RF-17: refuses a number with more than six digits", async () => {
      const response = await sayCode("1482913").expect(200);

      expect(speechOf(response)).toBe(REJECTED_SPEECH);
      await expectNothingChanged();
    });
  });

  it("RN-17: adds Diana to a device Bruno already uses, keeping Bruno", async () => {
    const dianaId = await createTherapist("diana@example.com", "Diana Rocha");
    await createCode("482913", brunoId);
    await createCode("519374", dianaId);
    await sayCode("482913").expect(200);

    const response = await sayCode("519374").expect(200);

    expect(speechOf(response)).toBe("<speak>Pronto. Esta Alexa agora atende Diana.</speak>");
    expect(await linkedTherapistIdsOf(ALEXA_TEST_DEVICE_ID)).toEqual([brunoId, dianaId].sort());
    expect(await prisma.alexaDevice.count()).toBe(1);
  });

  it("RN-17: a new code of an already linked therapist changes nothing on the device", async () => {
    await createCode("482913", brunoId);
    await sayCode("482913").expect(200);
    await createCode("519374", brunoId);

    const response = await sayCode("519374").expect(200);

    expect(speechOf(response)).toBe(PAIRED_SPEECH);
    expect(await linkedTherapistIdsOf(ALEXA_TEST_DEVICE_ID)).toEqual([brunoId]);
  });

  it("RF-17: only one of two devices saying the same code at the same time is paired", async () => {
    await createCode("482913", brunoId);

    const responses = await Promise.all([sayCode("482913"), sayCode("482913", OTHER_DEVICE_ID)]);

    expect(responses.map(speechOf).sort()).toEqual([REJECTED_SPEECH, PAIRED_SPEECH].sort());
    expect(await prisma.alexaDeviceTherapist.count()).toBe(1);
    expect(await prisma.alexaDevice.count()).toBe(1);
    expect(await prisma.auditEvent.count({ where: { action: "ALEXA_DEVICE_PAIRED" } })).toBe(1);
  });
});
