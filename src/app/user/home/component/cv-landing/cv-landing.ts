import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CvSubmissionService } from '../cv-ats/cv-submission.service';

@Component({
  selector: 'app-cv-landing',
  imports: [],
  templateUrl: './cv-landing.html',
  styleUrl: './cv-landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CvLanding implements OnInit {
  private readonly router = inject(Router);
  private readonly cvSubmissionService = inject(CvSubmissionService);

  protected readonly isCheckingCv = signal(true);
  protected readonly checkError = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const existingCv = await this.cvSubmissionService.fetchMyCv();
      if (existingCv) {
        await this.router.navigate(['/home/dashboard']);
        return;
      }
    } catch {
      this.checkError.set('Impossible de verifier votre CV pour le moment.');
    } finally {
      this.isCheckingCv.set(false);
    }
  }

  async goToCvAts(): Promise<void> {
    await this.router.navigate(['/home/cv-ats']);
  }
}