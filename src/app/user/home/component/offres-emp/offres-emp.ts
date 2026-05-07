import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OffresEmpService, StudentOffre } from './offres-emp.service';

interface Job {
  id: string;
  societeId?: number;
  title: string;
  type: string;
  selected: boolean;
  company: string;
  location: string;
  source: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  skills: string[];
  createdAt?: string;
}

interface CompanyJobs {
  company: string;
  location: string;
  jobs: Job[];
}

@Component({
  selector: 'app-offres-emp',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './offres-emp.html',
  styleUrls: ['./offres-emp.css']
})
export class OffresEmpComponent implements OnInit, OnDestroy {
  searchQuery = '';
  isLoading = false;
  errorMessage = '';
  submitMessage = '';
  submitMessageType: 'success' | 'error' = 'success';
  jobs: Job[] = [];
  selectedJob: Job | null = null;
  private readonly offresEmpService = inject(OffresEmpService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);

  private destroy$ = new Subject<void>();
  private submitMessageTimer: number | null = null;
  private loadWatchdog: number | null = null;

  ngOnInit(): void {
    this.loadOffres();
  }

  ngOnDestroy(): void {
    this.clearLoadWatchdog();
    this.clearSubmitMessageTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadOffres(): void {
    this.ngZone.run(() => {
      this.isLoading = true;
      this.errorMessage = '';
    });

    this.clearLoadWatchdog();
    this.loadWatchdog = window.setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage) {
          this.errorMessage = 'Le chargement des offres prend trop de temps. Veuillez reessayer.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    this.offresEmpService
      .fetchActiveOffres()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (offres) => {
          this.clearLoadWatchdog();
          this.ngZone.run(() => {
            this.jobs = (offres || []).map((offre) => this.toJob(offre));
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          this.clearLoadWatchdog();
          this.ngZone.run(() => {
            this.jobs = [];
            this.errorMessage = error?.message || 'Impossible de charger les offres pour le moment.';
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
      });
  }

  private toJob(offre: StudentOffre): Job {
    return {
      id: String(offre.id),
      societeId: Number(offre.societe_id || 0) || undefined,
      title: (offre.titre_poste || '').trim() || 'Poste sans titre',
      type: (offre.typeContrat || '').trim() || 'Offre',
      selected: false,
      company: (offre.societe || '').trim() || 'Entreprise',
      location: (offre.lieu || '').trim() || 'Tunisie',
      source: 'Entreprise',
      salaryMin: '',
      salaryMax: '',
      description: (offre.exigences || '').trim() || 'Aucune description fournie.',
      skills: Array.isArray(offre.competences) ? offre.competences : [],
      createdAt: offre.date_creation,
    };
  }

  get selectedJobs(): Job[] {
    return this.jobs.filter((j) => j.selected);
  }

  get filteredJobs(): Job[] {
    if (!this.searchQuery.trim()) return this.jobs;
    const q = this.searchQuery.toLowerCase();
    return this.jobs.filter((j) =>
      j.title.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      j.description.toLowerCase().includes(q)
    );
  }

  get groupedJobs(): CompanyJobs[] {
    const groups = new Map<string, CompanyJobs>();

    this.filteredJobs.forEach((job) => {
      const key = job.company.trim().toLowerCase() || 'entreprise';

      if (!groups.has(key)) {
        groups.set(key, {
          company: job.company,
          location: job.location,
          jobs: [],
        });
      }

      groups.get(key)!.jobs.push(job);
    });

    return Array.from(groups.values());
  }

  toggleJob(job: Job): void {
    job.selected = !job.selected;
  }

  postuler(): void {
    const selected = this.selectedJobs;
    if (selected.length === 0) {
      return;
    }

    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const studentId = Number(user?.id);

    if (!Number.isInteger(studentId) || studentId <= 0) {
      this.showSubmitMessage('error', 'Impossible d\'identifier votre compte étudiant. Veuillez vous reconnecter.');
      return;
    }

    const applications = selected
      .map((job) => ({
        id_post: Number(job.id),
        id_societe: job.societeId,
      }))
      .filter((item) => Number.isInteger(item.id_post) && item.id_post > 0);

    if (applications.length === 0) {
      this.showSubmitMessage('error', 'Aucune offre valide sélectionnée.');
      return;
    }

    this.offresEmpService
      .applyToOffres({
        id_etudiant: studentId,
        applications,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.jobs.forEach((job) => {
            job.selected = false;
          });
          this.showSubmitMessage('success', 'Candidature(s) envoyée(s)');
        },
        error: (error) => {
          this.showSubmitMessage('error', error?.message || 'Erreur lors de la candidature.');
        },
      });
  }

  closeSubmitMessage(): void {
    this.submitMessage = '';
    this.clearSubmitMessageTimer();
  }

  private showSubmitMessage(type: 'success' | 'error', message: string): void {
    this.submitMessageType = type;
    this.submitMessage = message;
    this.clearSubmitMessageTimer();
    this.submitMessageTimer = window.setTimeout(() => {
      this.submitMessage = '';
      this.submitMessageTimer = null;
    }, 5000);
  }

  private clearSubmitMessageTimer(): void {
    if (this.submitMessageTimer !== null) {
      window.clearTimeout(this.submitMessageTimer);
      this.submitMessageTimer = null;
    }
  }

  private clearLoadWatchdog(): void {
    if (this.loadWatchdog !== null) {
      window.clearTimeout(this.loadWatchdog);
      this.loadWatchdog = null;
    }
  }

  openDetails(job: Job): void {
    this.selectedJob = job;
  }

  closeDetails(): void {
    this.selectedJob = null;
  }

  getCompanyInitials(company: string): string {
    const words = (company || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return 'E';
    }
    if (words.length === 1) {
      return words[0].slice(0, 1).toUpperCase();
    }
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
}