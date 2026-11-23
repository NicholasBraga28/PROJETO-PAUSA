import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentActor } from "../auth/decorators/current-actor.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RequestActor } from "../auth/request-actor";
import { messages } from "../messages/catalog";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { NotificationService } from "./notification.service";

const notificationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(messages.errors.notificationNotFound),
});

@Controller("notifications")
@Roles("EMPLOYEE", "THERAPIST")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  list(@CurrentActor() actor: RequestActor, @Query() query: NotificationQueryDto) {
    return this.notifications.list(actor.id, query);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.OK)
  markAsRead(@CurrentActor() actor: RequestActor, @Param("id", notificationIdPipe) id: string) {
    return this.notifications.markAsRead(actor.id, id);
  }
}
