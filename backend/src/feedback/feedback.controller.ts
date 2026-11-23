import { Body, Controller, Post } from "@nestjs/common";
import { Roles } from "../auth/decorators/roles.decorator";
import { FeedbackService } from "./feedback.service";
import { SubmitFeedbackDto } from "./dto/submit-feedback.dto";

@Controller("feedback")
@Roles("EMPLOYEE")
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  submit(@Body() input: SubmitFeedbackDto) {
    return this.feedback.submit(input);
  }
}
