import { request } from "@/shared/api/client";
import { ChatMessageResult } from "@/shared/api/schemas";

export const sendChatMessage = (message: string) =>
  request("/chat/messages", ChatMessageResult, { method: "POST", body: { message }, includeUserId: false });
