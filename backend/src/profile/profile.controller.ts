import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getProfile(@Req() req: any) {
    const payload = req.user as { cin_passport?: number };
    const cin = Number(payload?.cin_passport);
    if (!Number.isFinite(cin)) {
      return { message: 'Profile not found', data: null };
    }

    const profile = await this.profileService.getByCin(cin);
    return { message: 'Profile fetched', data: profile };
  }
}
