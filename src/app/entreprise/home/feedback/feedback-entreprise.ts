import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';

import { SupabaseService } from '../../../services/supabase.service';

type StepType = 'radio' | 'checkbox' | 'stars' | 'satisfaction';

interface FeedbackStep {
  tag: string;
  question: string;
  type: StepType;
  hint?: string;
  options?: string[];
}

interface RatingMap {
  tech: number;
  prob: number;
  team: number;
  comm: number;
  auto: number;
  agil: number;
}

interface FeedbackForm {
  q1: string;
  q3: string;
  q4: string[];
  q5: string;
  q6: string;
  q7: number | null;
  ratings: RatingMap;
  otherGap: string;
}

@Component({
  selector: 'app-feedback-entreprise',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback-entreprise.html',
  styleUrl: './feedback-entreprise.css',
})
export class FeedbackEntreprise implements OnInit {
  readonly totalSteps = 7;
  readonly storageKey = 'enterprise-feedback-draft';
  readonly offlineKey = 'enterprise-feedback-offline';

  currentStep = 0;
  isSubmitting = false;
  submitError = '';
  submitSuccess = false;
  companyName = 'Entreprise partenaire';
  companySector = 'Entreprise';

  readonly ratingKeys: Array<keyof RatingMap> = ['tech', 'prob', 'team', 'comm', 'auto', 'agil'];
  readonly ratingLabels = [
    'Compétences techniques métier',
    'Résolution de problèmes',
    'Travail en équipe / Collaboration',
    'Communication professionnelle',
    'Autonomie & Gestion des priorités',
    'Capacité d\'apprentissage & Agilité',
  ];
  readonly ratingScale = [1, 2, 3, 4, 5, 6];
  readonly satisfactionScale = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  readonly satisfactionLabels = ['', 'Très insatisfait', 'Insatisfait', 'Plutôt insatisfait', 'Légèrement insatisfait', 'Neutre', 'Légèrement satisfait', 'Satisfait', 'Bien satisfait', 'Très satisfait', 'Extrêmement satisfait'];

  readonly steps: FeedbackStep[] = [
    {
      tag: 'Question 1 / 7',
      question: 'Quelle est la situation actuelle du diplômé dans votre entreprise ?',
      type: 'radio',
      options: ['Toujours en poste - même fonction', 'Toujours en poste - promu / changement de fonction', 'Mutation interne (autre département)', 'A quitté l\'entreprise (démission)', 'Fin de contrat (CDD/SIVP non renouvelé)', 'Licenciement / Rupture de période d\'essai'],
    },
    {
      tag: 'Question 2 / 7',
      question: 'Évaluez le diplômé ISGIS sur les dimensions suivantes',
      type: 'stars',
      hint: 'Notez chaque dimension de 1 (insuffisant) à 6 (excellent)',
    },
    {
      tag: 'Question 3 / 7',
      question: 'Le profil académique ISGIS correspond-il aux exigences du poste ?',
      type: 'radio',
      options: ['Très bien adapté - peu d\'effort d\'intégration requis', 'Bien adapté - adaptation rapide (< 1 mois)', 'Partiellement adapté - formation interne nécessaire', 'Peu adapté - écart significatif avec les besoins du poste'],
    },
    {
      tag: 'Question 4 / 7',
      question: 'Quelles lacunes avez-vous observées à l\'arrivée du diplômé ? (3 choix maximum)',
      type: 'checkbox',
      options: ['Maîtrise des outils métier (ERP, CFAO, Excel avancé...)', 'Anglais professionnel / technique', 'Gestion de projet et méthodes (Agile, Lean, 6 Sigma...)', 'Analyse de données / Outils BI', 'Communication écrite et orale professionnelle', 'Connaissance des processus industriels réels', 'Sens commercial / relation client', 'Aucune lacune notable', 'Autre'],
    },
    {
      tag: 'Question 5 / 7',
      question: 'Comment évaluez-vous la participation des diplômés dans la performance globale de votre société ?',
      type: 'radio',
      options: ['Progression rapide et remarquable', 'Progression régulière et satisfaisante', 'Progression lente mais continue', 'Stagnation / Peu d\'évolution observée'],
    },
    {
      tag: 'Question 6 / 7',
      question: 'Envisagez-vous de recruter d\'autres diplômés ISGIS ?',
      type: 'radio',
      options: ['Oui, certainement', 'Probablement oui', 'Incertain(e)', 'Non'],
    },
    {
      tag: 'Question 7 / 7',
      question: 'Sur une échelle de 0 à 10, quelle est votre satisfaction globale vis-à-vis du diplômé ISGIS ?',
      type: 'satisfaction',
    },
  ];

  form: FeedbackForm = this.createEmptyForm();

  constructor(private readonly supabaseService: SupabaseService) {}

  ngOnInit(): void {
    this.restoreDraft();
  }

  get progressPercent(): number {
    return Math.round(((this.currentStep + 1) / this.totalSteps) * 100);
  }

  get isLastStep(): boolean {
    return this.currentStep === this.totalSteps - 1;
  }

  get selectedGapCount(): number {
    return this.form.q4.length;
  }

  get currentKey(): 'q1' | 'q3' | 'q5' | 'q6' {
    if (this.currentStep === 0) return 'q1';
    if (this.currentStep === 2) return 'q3';
    if (this.currentStep === 4) return 'q5';
    return 'q6';
  }

  isRadioSelected(value: string): boolean {
    return this.form[this.currentKey] === value;
  }

  isGapSelected(value: string): boolean {
    return this.form.q4.includes(value);
  }

  setRadio(value: string): void {
    this.form[this.currentKey] = value;
    this.submitError = '';
    this.persistDraft();
  }

  toggleGap(value: string): void {
    const index = this.form.q4.indexOf(value);
    if (index >= 0) {
      this.form.q4.splice(index, 1);
    } else if (this.form.q4.length < 3) {
      this.form.q4.push(value);
    }

    if (!this.form.q4.includes('Autre')) {
      this.form.otherGap = '';
    }

    this.submitError = '';
    this.persistDraft();
  }

  setRating(metric: keyof RatingMap, value: number): void {
    this.form.ratings[metric] = value;
    this.submitError = '';
    this.persistDraft();
  }

  setSatisfaction(value: number): void {
    this.form.q7 = value;
    this.submitError = '';
    this.persistDraft();
  }

  onOtherGapInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.form.otherGap = target?.value ?? '';
    this.persistDraft();
  }

  nextStep(): void {
    if (!this.validateCurrentStep()) {
      return;
    }

    if (!this.isLastStep) {
      this.currentStep += 1;
      return;
    }

    void this.submit();
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
      this.submitError = '';
      this.submitSuccess = false;
    }
  }

  goToStep(index: number): void {
    if (index <= this.currentStep) {
      this.currentStep = index;
      this.submitError = '';
      this.submitSuccess = false;
    }
  }

  resetForm(): void {
    this.form = this.createEmptyForm();
    this.currentStep = 0;
    this.submitError = '';
    this.submitSuccess = false;
    localStorage.removeItem(this.storageKey);
  }

  satisfactionText(): string {
    const value = this.form.q7;
    return value ? (this.satisfactionLabels[value] ?? '') : '';
  }

  async submit(): Promise<void> {
    if (!this.validateAll()) {
      return;
    }

    const payload = this.buildPayload();
    this.isSubmitting = true;
    this.submitError = '';

    try {
      await this.supabaseService.adminClient.from('feedback_entreprise').insert([payload]);
      this.submitSuccess = true;
      localStorage.removeItem(this.storageKey);
    } catch {
      this.persistOffline(payload);
      this.submitSuccess = true;
    } finally {
      this.isSubmitting = false;
    }
  }

  private validateCurrentStep(): boolean {
    const current = this.steps[this.currentStep];

    if (current.type === 'radio' && !this.form[this.currentKey]) {
      this.submitError = 'Veuillez sélectionner une option.';
      return false;
    }

    if (current.type === 'checkbox' && this.form.q4.length === 0) {
      this.submitError = 'Veuillez choisir au moins une option.';
      return false;
    }

    if (current.type === 'stars' && this.ratingKeys.some(key => this.form.ratings[key] <= 0)) {
      this.submitError = 'Veuillez noter toutes les dimensions.';
      return false;
    }

    if (current.type === 'satisfaction' && this.form.q7 === null) {
      this.submitError = 'Veuillez sélectionner une note.';
      return false;
    }

    this.submitError = '';
    return true;
  }

  private validateAll(): boolean {
    const snapshot = this.currentStep;
    for (let i = 0; i < this.steps.length; i += 1) {
      this.currentStep = i;
      if (!this.validateCurrentStep()) {
        this.currentStep = snapshot;
        return false;
      }
    }

    this.currentStep = snapshot;
    return true;
  }

  private buildPayload(): Record<string, unknown> {
    const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
    const toGap = (value: number) => clamp(((6 - value) / 6) * 100);

    return {
      entreprise: this.companyName,
      secteur: this.companySector,
      promotion: new Date().getFullYear(),
      satisfaction_globale: this.form.q7 ?? 0,
      recrutement_envisage: this.form.q6,
      profil_adequat_poste: this.form.q3,
      contribution_performance: this.form.q5,
      situation_actuelle_diplome: this.form.q1,
      competences_techniques_metier: this.form.ratings.tech,
      resolution_problemes: this.form.ratings.prob,
      travail_equipe_collaboration: this.form.ratings.team,
      communication_professionnelle: this.form.ratings.comm,
      autonomie_gestion_priorites: this.form.ratings.auto,
      capacite_apprentissage_agilite: this.form.ratings.agil,
      lacune_experience_terrain: toGap(this.form.ratings.tech),
      lacune_outils_tms_wms: toGap(this.form.ratings.prob),
      lacune_gestion_crise_logistique: toGap(this.form.ratings.team),
      lacune_reglementation_transport: toGap(this.form.ratings.comm),
      lacune_communication_clients: toGap(this.form.ratings.auto),
      lacune_anglais_operationnel: toGap(this.form.ratings.agil),
      message_suggestion: this.form.otherGap.trim(),
    };
  }

  private persistDraft(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.form));
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as FeedbackForm;
      this.form = {
        q1: draft.q1 ?? '',
        q3: draft.q3 ?? '',
        q4: Array.isArray(draft.q4) ? draft.q4 : [],
        q5: draft.q5 ?? '',
        q6: draft.q6 ?? '',
        q7: typeof draft.q7 === 'number' ? draft.q7 : null,
        ratings: {
          tech: draft.ratings?.tech ?? 0,
          prob: draft.ratings?.prob ?? 0,
          team: draft.ratings?.team ?? 0,
          comm: draft.ratings?.comm ?? 0,
          auto: draft.ratings?.auto ?? 0,
          agil: draft.ratings?.agil ?? 0,
        },
        otherGap: draft.otherGap ?? '',
      };
    } catch {
      // Ignore malformed drafts.
    }
  }

  private persistOffline(payload: Record<string, unknown>): void {
    try {
      const raw = localStorage.getItem(this.offlineKey);
      const existing = raw ? (JSON.parse(raw) as Record<string, unknown>[]) : [];
      existing.push({ ...payload, submittedAt: new Date().toISOString() });
      localStorage.setItem(this.offlineKey, JSON.stringify(existing));
    } catch {
      // Ignore offline persistence failures.
    }
  }

  private createEmptyForm(): FeedbackForm {
    return {
      q1: '',
      q3: '',
      q4: [],
      q5: '',
      q6: '',
      q7: null,
      ratings: {
        tech: 0,
        prob: 0,
        team: 0,
        comm: 0,
        auto: 0,
        agil: 0,
      },
      otherGap: '',
    };
  }
}
