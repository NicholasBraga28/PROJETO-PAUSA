import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { SendChatMessageDto } from "./send-chat-message.dto";

describe("SendChatMessageDto", () => {
  it("TK-15.02 RF-34: trims the message and accepts a non-empty question", async () => {
    const dto = plainToInstance(SendChatMessageDto, { message: "  Como funciona?  " });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.message).toBe("Como funciona?");
  });

  it.each(["", "   ", 42, null, undefined])(
    "TK-15.02 RF-34: rejects an empty or non-text question",
    async (message) => {
      const dto = plainToInstance(SendChatMessageDto, { message });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );

  it("TK-15.02 RF-34: accepts the maximum of 500 characters", async () => {
    const dto = plainToInstance(SendChatMessageDto, { message: "x".repeat(500) });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("TK-15.02 RF-34: rejects a question longer than 500 characters", async () => {
    const dto = plainToInstance(SendChatMessageDto, { message: "x".repeat(501) });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
