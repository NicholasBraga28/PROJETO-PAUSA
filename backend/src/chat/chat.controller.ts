import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../auth/decorators/public.decorator";
import { ChatService } from "./chat.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Public()
  @Post("messages")
  respond(@Body() body: SendChatMessageDto) {
    return this.chat.respond(body.message);
  }
}
