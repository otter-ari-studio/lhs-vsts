import { Controller, Get } from "@nestjs/common";

import { AppService } from "./app.service.js";

@Controller("api/health")
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
