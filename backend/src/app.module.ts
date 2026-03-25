import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { RefCompetanceModule } from 'src/ref_competance/ref_competance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Support both execution styles:
      // 1) run from backend folder ('.env')
      // 2) run from monorepo root ('backend/.env')
      envFilePath: ['.env', 'backend/.env'],
    }),
    AuthModule,
    ProfileModule,
    RefCompetanceModule,
  ],
})
export class AppModule {}
