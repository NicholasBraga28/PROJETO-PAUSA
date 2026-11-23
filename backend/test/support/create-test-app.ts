import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ALEXA_REQUEST_VERIFIER } from "../../src/alexa/alexa-request-verifier";
import { PAIRING_CODE_SOURCE, PairingCodeSource } from "../../src/alexa/pairing-code-source";
import { AppModule } from "../../src/app.module";
import { AUTH_OPTIONS, AuthOptions } from "../../src/auth/auth-options";
import { CLOCK, Clock } from "../../src/common/clock/clock";
import type { AuthMode } from "../../src/config/env.validation";
import { configureApp } from "../../src/configure-app";
import { NOTIFICATION_CHANNEL, NotificationChannel } from "../../src/notifications/notification-channel";
import { PrismaService } from "../../src/prisma/prisma.service";
import { FakeAlexaRequestVerifier } from "./fake-alexa-request-verifier";

export type TestApp = { app: INestApplication; prisma: PrismaService };
export type TestAppOptions = Readonly<{
  clock?: Clock;
  authMode?: AuthMode;
  notificationChannel?: NotificationChannel;
  pairingCodeSource?: PairingCodeSource;
}>;

const authOptionsWithoutGoogleAccount = (mode: AuthMode): AuthOptions => ({
  mode,
  googleClientId: "",
  googleWorkspaceDomain: "",
});

export async function createTestApp({
  clock,
  authMode,
  notificationChannel,
  pairingCodeSource,
}: TestAppOptions = {}): Promise<TestApp> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ALEXA_REQUEST_VERIFIER)
    .useValue(new FakeAlexaRequestVerifier());
  if (clock) builder.overrideProvider(CLOCK).useValue(clock);
  if (authMode) builder.overrideProvider(AUTH_OPTIONS).useValue(authOptionsWithoutGoogleAccount(authMode));
  if (notificationChannel) builder.overrideProvider(NOTIFICATION_CHANNEL).useValue(notificationChannel);
  if (pairingCodeSource) builder.overrideProvider(PAIRING_CODE_SOURCE).useValue(pairingCodeSource);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
