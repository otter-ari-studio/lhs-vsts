import { Body, Controller, Get, Post } from "@nestjs/common";
import { ScoresService } from "./scores.service.js";

@Controller("api/scores")
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Get()
  list() {
    return this.scoresService.list();
  }

  @Post()
  append(@Body() body: unknown) {
    return this.scoresService.append(body);
  }
}
