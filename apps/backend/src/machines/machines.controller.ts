import { Body, Controller, Get, Put } from '@nestjs/common';
import { MachinesService } from './machines.service.js';

@Controller('api/machines')
export class MachinesController {
  constructor(private readonly machinesService: MachinesService) {}

  @Get('current')
  getCurrent() {
    return this.machinesService.getCurrent();
  }

  @Put('current')
  putCurrent(@Body() body: unknown) {
    return this.machinesService.putCurrent(body);
  }
}
