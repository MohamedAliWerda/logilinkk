import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-cv-ats',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './cv-ats.component.html',
  styleUrls: ['./cv-ats.component.css']
})
export class CvAtsComponent {
  activeTab = 'infos';
  atsScore = 0;

  tabs = [
    { key: 'infos',        label: 'Infos personnelles', icon: '👤' },
    { key: 'resume',       label: 'Résumé',             icon: '≡' },
    { key: 'formation',    label: 'Formation',          icon: '🎓' },
    { key: 'experiences',  label: 'Expériences',        icon: '🏛' },
    { key: 'competences',  label: 'Compétences',        icon: '🔧' },
    { key: 'langues',      label: 'Langues',            icon: '🌐' },
  ];

  infosForm: FormGroup;
  resumeText = '';
  languesText = 'Arabe (natif), Français (courant), Anglais (intermédiaire)';
  certificationsText = 'DELF B2, TOEIC 750, Lean Six Sigma...';
  formations = [
    { diplome: 'Licence en Log', etablissement: 'ISGI Sfax', annee: '2025' }
  ];
  experiences = [
    { poste: 'Stagiaire en logistique', entreprise: 'Tunisie Logistique SA', dateDebut: '', dateFin: '', description: '' }
  ];
  competences = [
    { nom: '' }
  ];

  activeMenu = 'cv';

  constructor(private fb: FormBuilder, private router: Router) {
    this.infosForm = this.fb.group({
      nomComplet: [''],
      email: [''],
      telephone: [''],
      adresse: [''],
      linkedin: [''],
      specialite: [''],
    });
  }

  setTab(key: string) { this.activeTab = key; }

  getCurrentStep(): number {
    return this.tabs.findIndex(t => t.key === this.activeTab) + 1;
  }

  next() {
    const idx = this.tabs.findIndex(t => t.key === this.activeTab);
    if (idx < this.tabs.length - 1) this.activeTab = this.tabs[idx + 1].key;
  }

  prev() {
    const idx = this.tabs.findIndex(t => t.key === this.activeTab);
    if (idx > 0) this.activeTab = this.tabs[idx - 1].key;
  }

  addFormation() {
    this.formations.push({ diplome: '', etablissement: '', annee: '' });
  }

  removeFormation(i: number) {
    this.formations.splice(i, 1);
  }

  addExperience() {
    this.experiences.push({ poste: '', entreprise: '', dateDebut: '', dateFin: '', description: '' });
  }

  removeExperience(i: number) {
    this.experiences.splice(i, 1);
  }

  addCompetence() {
    this.competences.push({ nom: '' });
  }

  removeCompetence(i: number) {
    this.competences.splice(i, 1);
  }

  setMenu(menu: string) { this.activeMenu = menu; }

  logout() { this.router.navigate(['/']); }

  navigateTo(menu: string) {
    this.setMenu(menu);
    if (menu === 'dashboard') this.router.navigate(['/dashboard']);
  }
}
