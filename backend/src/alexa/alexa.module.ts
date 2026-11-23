import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { SchedulesModule } from "../schedules/schedules.module";
import { TherapistsModule } from "../therapists/therapists.module";
import { AlexaController } from "./alexa.controller";
import { AlexaDispatcher } from "./alexa-dispatcher";
import { ALEXA_INTENT_HANDLERS, AlexaIntentHandler } from "./alexa-intent-handler";
import { AlexaRequestContextResolver } from "./alexa-request-context-resolver";
import { ALEXA_REQUEST_VERIFIER, AskSdkAlexaRequestVerifier } from "./alexa-request-verifier";
import { AlexaResponseBuilder } from "./alexa-response-builder";
import { AlexaSpeakerResolver } from "./alexa-speaker-resolver";
import { DevicePairingService } from "./device-pairing.service";
import { BlockScheduleIntentHandler } from "./handlers/block-schedule-intent.handler";
import { CancelAppointmentIntentHandler } from "./handlers/cancel-appointment-intent.handler";
import { NoIntentHandler, YesIntentHandler } from "./handlers/confirmation-answer-intent.handler";
import { FallbackHandler } from "./handlers/fallback.handler";
import { FinishSessionIntentHandler } from "./handlers/finish-session-intent.handler";
import { HelpIntentHandler } from "./handlers/help-intent.handler";
import { IdentifySpeakerIntentHandler } from "./handlers/identify-speaker-intent.handler";
import { LaunchRequestHandler } from "./handlers/launch-request.handler";
import { NextAppointmentIntentHandler } from "./handlers/next-appointment-intent.handler";
import { PairDeviceIntentHandler } from "./handlers/pair-device-intent.handler";
import { PresentationInviteIntentHandler } from "./handlers/presentation-invite-intent.handler";
import { RepeatIntentHandler } from "./handlers/repeat-intent.handler";
import { SessionEndedRequestHandler } from "./handlers/session-ended-request.handler";
import { StartSessionIntentHandler } from "./handlers/start-session-intent.handler";
import { StopIntentHandler } from "./handlers/stop-intent.handler";
import { TodayAgendaIntentHandler } from "./handlers/today-agenda-intent.handler";
import { WhoArrivedIntentHandler } from "./handlers/who-arrived-intent.handler";
import { CryptoPairingCodeSource, PAIRING_CODE_SOURCE } from "./pairing-code-source";
import { PairingCodesController } from "./pairing-codes.controller";
import { PairingCodesService } from "./pairing-codes.service";
import { PendingActionsService } from "./pending-actions.service";

export const INTENT_HANDLERS = [
  LaunchRequestHandler,
  PairDeviceIntentHandler,
  NextAppointmentIntentHandler,
  TodayAgendaIntentHandler,
  WhoArrivedIntentHandler,
  StartSessionIntentHandler,
  FinishSessionIntentHandler,
  CancelAppointmentIntentHandler,
  BlockScheduleIntentHandler,
  YesIntentHandler,
  NoIntentHandler,
  IdentifySpeakerIntentHandler,
  PresentationInviteIntentHandler,
  StopIntentHandler,
  HelpIntentHandler,
  RepeatIntentHandler,
  SessionEndedRequestHandler,
];

@Module({
  imports: [PrismaModule, SchedulesModule, TherapistsModule],
  controllers: [AlexaController, PairingCodesController],
  providers: [
    PairingCodesService,
    DevicePairingService,
    PendingActionsService,
    { provide: PAIRING_CODE_SOURCE, useClass: CryptoPairingCodeSource },
    { provide: ALEXA_REQUEST_VERIFIER, useClass: AskSdkAlexaRequestVerifier },
    ...INTENT_HANDLERS,
    FallbackHandler,
    {
      provide: ALEXA_INTENT_HANDLERS,
      useFactory: (...handlers: AlexaIntentHandler[]) => handlers,
      inject: INTENT_HANDLERS,
    },
    AlexaSpeakerResolver,
    AlexaRequestContextResolver,
    AlexaDispatcher,
    AlexaResponseBuilder,
  ],
  exports: [ALEXA_REQUEST_VERIFIER],
})
export class AlexaModule {}
