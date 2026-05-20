import { Controller, Get } from '@nestjs/common';
import { Body, Post } from '@nestjs/common';
import { AncienEtudiantsService } from './ancien-etudiants.service';
import { MailService } from './mail.service';

@Controller('admin')
export class AncienEtudiantsController {
  constructor(
    private readonly service: AncienEtudiantsService,
    private readonly mailService: MailService,
  ) {}

  @Get()
  async findAll() {
    return this.service.fetchAll();
  }

  @Get('ancien-etudiants')
  async findAncienEtudiants() {
    return this.service.fetchAll();
  }

  @Get('feedback')
  async findFeedback() {
    return this.service.fetchTable('feedback');
  }

  @Post('ancien-etudiants')
  async createAncienEtudiant(@Body() body: Record<string, unknown>) {
    return this.service.createAncienEtudiant(body);
  }

  @Post('feedback')
  async createFeedback(@Body() body: Record<string, unknown>) {
    return this.service.createFeedback(body);
  }

  @Post('ancien-etudiants/send-invitations')
  async sendInvitations(
    @Body() body: { subject?: string; message?: string } = {},
  ) {
    const subject = (body.subject ?? '').trim() || 'Partagez votre expérience professionnelle - ISGI';
    const message = (body.message ?? '').trim() || 'Nous aimerions connaître votre parcours professionnel.\n\n[Lien vers le formulaire]';
    return this.service.sendInvitationsToUncontacted(subject, message);
  }

  @Post('ancien-etudiants/google-form-submission')
  async googleFormSubmission(@Body() body: Record<string, any>) {
    return this.service.ingestGoogleFormSubmission(body ?? {});
  }

  @Post('societe/send-approval-email')
  async sendApprovalEmail(@Body() body: { email: string; companyName: string }) {
    const email = (body?.email ?? '').trim();
    const companyName = (body?.companyName ?? '').trim() || 'Votre société';
    if (!email) {
      return { success: false, reason: 'Email manquant' };
    }
    await this.mailService.sendCompanyApproval(email, companyName);
    return { success: true };
  }

  @Post('societe/send-rejection-email')
  async sendRejectionEmail(@Body() body: { email: string; companyName: string }) {
    const email = (body?.email ?? '').trim();
    const companyName = (body?.companyName ?? '').trim() || 'Votre société';
    if (!email) {
      return { success: false, reason: 'Email manquant' };
    }
    await this.mailService.sendCompanyRejection(email, companyName);
    return { success: true };
  }

  @Post('societe/send-pending-email')
  async sendPendingEmail(@Body() body: { email: string; companyName: string }) {
    const email = (body?.email ?? '').trim();
    const companyName = (body?.companyName ?? '').trim() || 'Votre société';
    if (!email) {
      return { success: false, reason: 'Email manquant' };
    }
    await this.mailService.sendCompanyPending(email, companyName);
    return { success: true };
  }
}
