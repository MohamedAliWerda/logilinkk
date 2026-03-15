import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

type Level = 'Debutant' | 'Notions' | 'Intermediaire' | 'Avance' | 'Expert';

interface AtsResult {
  matchScore: number;
  overallScore: number;
  successScore: number;
  missingKeywords: string;
  profileSummary: string;
  suggestions: string;
}

@Component({
  selector: 'app-cv-ats',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cv-ats.html',
  styleUrls: ['./cv-ats.css']
})
export class CvAts {
  showPreview = false;
  step = 1;
  formError = '';

  steps = [
    { label: 'Infos', icon: 'fa-user' },
    { label: 'Profil', icon: 'fa-bullseye' },
    { label: 'Formation', icon: 'fa-graduation-cap' },
    { label: 'Stages', icon: 'fa-briefcase' },
    { label: 'Hard Skills', icon: 'fa-code' },
    { label: 'Soft Skills', icon: 'fa-people-group' },
    { label: 'Langues', icon: 'fa-globe' },
    { label: 'Projets', icon: 'fa-diagram-project' },
    { label: 'Certifs', icon: 'fa-award' },
    { label: 'Para-Univ.', icon: 'fa-handshake-angle' },
    { label: 'Validation', icon: 'fa-circle-check' }
  ];

  info = {
    prenom: '', nom: '', email: '', telephone: '',
    ville: '', codePostal: '', linkedin: '',
    dateNaissance: '', permis: '', photoName: ''
  };

  professionalTitle = '';
  specialization = '';
  objectif = '';

  formations = [{
    diplome: '', institution: 'ISGIS - Universite de Sfax',
    dateDebut: '', dateFin: '', moyenne: '', modules: '',
    pfeTitre: '', pfeEntreprise: '', pfeTechnologies: ''
  }];

  experiences = [{
    poste: '', entreprise: '', secteur: '', dateDebut: '',
    dateFin: '', lieu: '', description: '', motsCles: ''
  }];

  hardSkills = [
    { type: 'Metier T&L', nom: '', niveau: 'Intermediaire' as Level },
    { type: 'Outil / Logiciel', nom: '', niveau: 'Intermediaire' as Level }
  ];

  softSkills = [{ nom: 'Communication', niveau: 'Intermediaire' as Level, contexte: '' }];
  langues = [{ langue: '', niveau: 'B1', certification: '', score: '' }];
  projets = [{ titre: '', description: '', technologies: '', lien: '' }];
  certifications = [{ titre: '', organisme: '', date: '', verification: '' }];
  engagements = [{ type: 'Associatif', role: '', dateDebut: '', dateFin: '' }];
  interests = [{ label: '' }];

  consentGiven = false;
  studentId = 'AUTO-ISGIS';
  createdAt = new Date().toISOString();
  updatedAt = new Date().toISOString();
  atsScore = 0;
  cohortRank = 0;

  niveaux: Level[] = ['Debutant', 'Notions', 'Intermediaire', 'Avance', 'Expert'];
  niveauxLangue = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  secteurOptions = ['Transport routier', 'Transport maritime', 'Transport aerien', 'Logistique 3PL/4PL', 'Supply Chain', 'Douane'];
  engagementTypes = ['Associatif', 'Sport', 'Benevolat', 'Club'];
  permisOptions = ['Aucun', 'B', 'C', 'CE', 'D'];

  atsJobDescription = '';
  atsLoading = false;
  atsError = '';
  atsResult: AtsResult | null = null;

  constructor(private router: Router) {}

  get totalSteps(): number { return this.steps.length; }

  get fullName(): string { return `${this.info.prenom} ${this.info.nom}`.trim(); }

  get interestLabels(): string {
    return this.interests.map(it => it.label.trim()).filter(l => !!l).join(', ');
  }

  goTo(step: number) {
    if (step >= 1 && step <= this.totalSteps) {
      this.step = step;
      this.formError = '';
    }
  }

  next() {
    if (!this.canGoNext()) {
      this.formError = 'Veuillez remplir les champs obligatoires de cette etape.';
      return;
    }
    this.formError = '';
    if (this.step < this.totalSteps) this.step += 1;
  }

  prev() {
    this.formError = '';
    if (this.step > 1) this.step -= 1;
  }

  canGoNext(): boolean {
    if (this.step === 1)
      return !!(this.info.prenom.trim() && this.info.nom.trim() && this.info.email.trim() && this.info.telephone.trim());
    if (this.step === 2)
      return !!(this.professionalTitle.trim() && this.objectif.trim());
    if (this.step === 3) {
      const f = this.formations[0];
      return !!(f?.diplome.trim() && f?.institution.trim() && f?.dateDebut && f?.dateFin);
    }
    if (this.step === 4) {
      const e = this.experiences[0];
      return !!(e?.poste.trim() && e?.entreprise.trim() && e?.dateDebut && e?.dateFin && e?.description.trim() && e?.motsCles.trim());
    }
    return true;
  }

  generate() {
    if (!this.consentGiven) {
      this.formError = 'Le consentement RGPD / Loi tunisienne est obligatoire pour generer le CV.';
      return;
    }
    this.formError = '';
    this.updatedAt = new Date().toISOString();
    this.atsScore = this.computeCompletenessScore();
    this.cohortRank = Math.max(1, 100 - Math.round(this.atsScore));
    this.showPreview = true;
  }

  backToForm() { this.showPreview = false; }

  download() {
    const printContent = document.getElementById('cv-paper');
    if (!printContent) return;

    const cvStyles = `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Times New Roman', Times, serif; color: #111; background: #fff; line-height: 1.5; }
      @page { size: A4; margin: 15mm; }
      .cv-paper { background: #fff; font-family: 'Times New Roman', Times, serif; color: #111; line-height: 1.5; }
      .ats-header { text-align: center; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #111; }
      .ats-name { font-size: 1.75rem; font-weight: 700; color: #111; margin: 0 0 4px; letter-spacing: 0.02em; text-transform: uppercase; }
      .ats-title { font-size: 0.95rem; color: #333; margin: 0 0 2px; font-style: italic; }
      .ats-subtitle { font-size: 0.88rem; color: #475569; font-weight: 500; margin: 0 0 10px; }
      .ats-contacts { display: flex; flex-wrap: wrap; justify-content: center; gap: 0; font-size: 0.82rem; color: #333; margin-top: 6px; }
      .ats-contacts span { display: inline; }
      .ats-contacts span + span::before { content: ' | '; color: #888; }
      .ats-section { margin-bottom: 18px; }
      .ats-section-title { font-size: 0.82rem; font-weight: 700; color: #111; letter-spacing: 0.12em; text-transform: uppercase; border-bottom: 1.5px solid #111; padding-bottom: 3px; margin-bottom: 10px; font-family: 'Arial', sans-serif; }
      .ats-objective { font-size: 0.88rem; color: #222; margin: 0; line-height: 1.6; text-align: justify; }
      .ats-entry { margin-bottom: 12px; }
      .ats-entry-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
      .ats-entry-left { display: flex; flex-direction: column; }
      .ats-entry-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
      .ats-entry-main { font-size: 0.92rem; font-weight: 700; color: #111; }
      .ats-entry-org { font-size: 0.84rem; color: #444; font-style: italic; }
      .ats-entry-date { font-size: 0.80rem; color: #555; white-space: nowrap; }
      .ats-entry-detail { font-size: 0.78rem; color: #666; }
      .ats-entry-desc { font-size: 0.84rem; color: #333; margin: 5px 0 0; line-height: 1.55; text-align: justify; }
      .ats-skills-wrap { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 24px; }
      .ats-skill-item { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.84rem; padding: 2px 0; border-bottom: 1px dotted #ccc; }
      .ats-skill-name { color: #111; font-weight: 600; }
      .ats-skill-level { color: #555; font-style: italic; font-size: 0.78rem; }
      strong { font-weight: 700; }
    `;

    const popupWin = window.open('', '_blank', 'width=900,height=1200');
    if (!popupWin) return;
    popupWin.document.open();
    popupWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CV ATS - ${this.fullName || 'Etudiant'}</title><style>${cvStyles}</style></head><body onload="window.print(); window.close();">${printContent.outerHTML}</body></html>`);
    popupWin.document.close();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.info.photoName = input.files?.[0]?.name ?? '';
  }

  addFormation() { this.formations.push({ diplome: '', institution: 'ISGIS - Universite de Sfax', dateDebut: '', dateFin: '', moyenne: '', modules: '', pfeTitre: '', pfeEntreprise: '', pfeTechnologies: '' }); }
  removeFormation(i: number) { if (this.formations.length > 1) this.formations.splice(i, 1); }

  addExperience() { this.experiences.push({ poste: '', entreprise: '', secteur: '', dateDebut: '', dateFin: '', lieu: '', description: '', motsCles: '' }); }
  removeExperience(i: number) { if (this.experiences.length > 1) this.experiences.splice(i, 1); }

  addHardSkill() { this.hardSkills.push({ type: 'Metier T&L', nom: '', niveau: 'Intermediaire' }); }
  removeHardSkill(i: number) { if (this.hardSkills.length > 1) this.hardSkills.splice(i, 1); }

  addSoftSkill() { this.softSkills.push({ nom: '', niveau: 'Intermediaire', contexte: '' }); }
  removeSoftSkill(i: number) { if (this.softSkills.length > 1) this.softSkills.splice(i, 1); }

  addLangue() { this.langues.push({ langue: '', niveau: 'B1', certification: '', score: '' }); }
  removeLangue(i: number) { if (this.langues.length > 1) this.langues.splice(i, 1); }

  addProjet() { this.projets.push({ titre: '', description: '', technologies: '', lien: '' }); }
  removeProjet(i: number) { if (this.projets.length > 1) this.projets.splice(i, 1); }

  addCertification() { this.certifications.push({ titre: '', organisme: '', date: '', verification: '' }); }
  removeCertification(i: number) { if (this.certifications.length > 1) this.certifications.splice(i, 1); }

  addEngagement() { this.engagements.push({ type: 'Associatif', role: '', dateDebut: '', dateFin: '' }); }
  removeEngagement(i: number) { if (this.engagements.length > 1) this.engagements.splice(i, 1); }

  addInterest() { if (this.interests.length < 5) this.interests.push({ label: '' }); }
  removeInterest(i: number) { if (this.interests.length > 1) this.interests.splice(i, 1); }

  skillWidth(level: Level): string {
    const widths: Record<Level, string> = { Debutant: '20%', Notions: '40%', Intermediaire: '60%', Avance: '80%', Expert: '100%' };
    return widths[level];
  }

  skillColor(level: Level): string {
    const colors: Record<Level, string> = { Debutant: '#94a3b8', Notions: '#60a5fa', Intermediaire: '#22c55e', Avance: '#f59e0b', Expert: '#ef4444' };
    return colors[level];
  }

  scoreColor(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  scoreGrade(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Correct';
    return 'A ameliorer';
  }

  checkAts() {
    const jd = this.atsJobDescription.trim();
    if (!jd) { this.atsError = 'Veuillez coller une offre d emploi.'; return; }
    this.atsLoading = true;
    this.atsError = '';
    this.atsResult = null;

    setTimeout(() => {
      const descriptionKeywords = this.extractKeywords(jd);
      const profileKeywords = new Set(this.extractKeywords(this.profileAsText()));
      let matched = 0;
      for (const k of descriptionKeywords) { if (profileKeywords.has(k)) matched++; }
      const matchScore = Math.min(100, Math.round((matched / Math.max(descriptionKeywords.length, 1)) * 100));
      const completeness = this.computeCompletenessScore();
      const structureScore = this.computeStructureScore();
      const sectorScore = this.computeSectorRelevance(descriptionKeywords, profileKeywords);
      const overallScore = Math.round(matchScore * 0.4 + structureScore * 0.2 + completeness * 0.2 + sectorScore * 0.2);
      const successScore = Math.round(overallScore * 0.65 + matchScore * 0.35);
      const missing = descriptionKeywords.filter(k => !profileKeywords.has(k)).slice(0, 12);
      this.atsScore = overallScore;
      this.cohortRank = Math.max(1, 100 - Math.round(overallScore));
      this.atsResult = {
        matchScore, overallScore, successScore,
        missingKeywords: missing.join(', '),
        profileSummary: `${this.fullName || 'Profil'} - ${this.professionalTitle || 'Etudiant'} avec ${this.hardSkills.filter(s => s.nom.trim()).length} hard skills.`,
        suggestions: this.buildSuggestions(missing)
      };
      this.atsLoading = false;
    }, 750);
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['avec', 'pour', 'dans', 'une', 'des', 'les', 'sur', 'par', 'this', 'that', 'from', 'vous', 'votre', 'vos', 'etre', 'avoir', 'plus', 'moins', 'nous', 'leur', 'the', 'and']);
    return Array.from(new Set(
      text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))
    )).slice(0, 180);
  }

  private profileAsText(): string {
    return [
      this.fullName, this.professionalTitle, this.specialization, this.objectif,
      ...this.formations.map(f => `${f.diplome} ${f.institution} ${f.modules} ${f.pfeTitre} ${f.pfeTechnologies}`),
      ...this.experiences.map(e => `${e.poste} ${e.entreprise} ${e.secteur} ${e.description} ${e.motsCles}`),
      ...this.hardSkills.map(h => `${h.type} ${h.nom}`),
      ...this.softSkills.map(s => `${s.nom} ${s.contexte}`),
      ...this.langues.map(l => `${l.langue} ${l.niveau} ${l.certification}`),
      ...this.projets.map(p => `${p.titre} ${p.description} ${p.technologies}`),
      ...this.certifications.map(c => `${c.titre} ${c.organisme}`)
    ].join(' ');
  }

  private computeCompletenessScore(): number {
    const checks = [
      !!this.info.prenom.trim(), !!this.info.nom.trim(), !!this.info.email.trim(), !!this.info.telephone.trim(),
      !!this.professionalTitle.trim(), !!this.objectif.trim(), !!this.formations[0]?.diplome.trim(),
      !!this.experiences[0]?.poste.trim(), !!this.hardSkills.some(h => h.nom.trim()),
      !!this.softSkills.some(s => s.nom.trim()), !!this.langues.some(l => l.langue.trim()), !!this.consentGiven
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  private computeStructureScore(): number {
    const sections = [
      this.formations.some(f => f.diplome.trim()), this.experiences.some(e => e.poste.trim() && e.description.trim()),
      this.hardSkills.some(h => h.nom.trim()), this.softSkills.some(s => s.nom.trim()),
      this.langues.some(l => l.langue.trim()), this.projets.some(p => p.titre.trim()),
      this.certifications.some(c => c.titre.trim())
    ];
    return Math.round((sections.filter(Boolean).length / sections.length) * 100);
  }

  private computeSectorRelevance(desc: string[], profile: Set<string>): number {
    const tokens = ['logistique', 'supply', 'transport', 'douane', 'incoterms', 'wms', 'tms', 'sap', 'excel', 'powerbi'];
    const sel = desc.filter(k => tokens.includes(k));
    if (!sel.length) return 65;
    return Math.round((sel.filter(k => profile.has(k)).length / sel.length) * 100);
  }

  private buildSuggestions(missing: string[]): string {
    const tips: string[] = [];
    if (missing.length) tips.push(`Ajoutez ces mots-cles: ${missing.slice(0, 6).join(', ')}.`);
    if (!this.info.permis || this.info.permis === 'Aucun') tips.push('Renseignez votre permis de conduire.');
    if (!this.experiences.some(e => /\d/.test(e.description))) tips.push('Ajoutez des resultats chiffres dans vos missions.');
    if (!this.langues.some(l => ['B2', 'C1', 'C2'].includes(l.niveau))) tips.push('Precisez une langue avec niveau B2 ou plus.');
    return tips.join(' ');
  }
}