import { Controller, Get } from '@nestjs/common';
import { GapsService } from './gaps.service';

@Controller('admin')
export class GapsController {
  constructor(private readonly gapsService: GapsService) {}

  @Get('gaps')
  async getGaps() {
    return this.gapsService.getDashboard();
  }
}
