import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('top-gaps')
  async getTopGaps() {
    return this.dashboardService.getTopGaps();
  }

  @Get('students')
  async getRecentStudents(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(500, Math.floor(parsed)) : 5;
    return this.dashboardService.getRecentStudents(safeLimit);
  }
}
