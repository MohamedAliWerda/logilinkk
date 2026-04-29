import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures.html',
  styleUrls: ['./candidatures.css']
})
export class Candidatures {

  searchQuery = '';

  postes = [
    'Tous',
    'Développeur Full Stack',
    'UX Designer',
    'Data Analyst'
  ];

  selectedPoste = 'Tous';

  candidatures = [
    {
      prenom: 'Amira', nom: 'Belhassen',
      email: 'amira@email.com',
      ville: 'Tunis',
      timeAgo: '2j',
      score: 92,
      poste: 'Développeur Full Stack',
      competences: ['React', 'Node.js', 'PostgreSQL'],
      
    },
    {
      prenom: 'Mehdi', nom: 'Khaled',
      email: 'mehdi@email.com',
      ville: 'Sfax',
      timeAgo: '4j',
      score: 85,
      poste: 'Data Analyst',
      competences: ['Python', 'Docker'],
      statut: 'progress'
    },
    {
      prenom: 'Sarra', nom: 'Mansouri',
      email: 'sarra@email.com',
      ville: 'Tunis',
      timeAgo: '1j',
      score: 78,
      poste: 'UX Designer',
      competences: ['Angular', 'MongoDB'],
      statut: 'new'
    }
  ];

  /* ===== FILTRE ===== */

  setPoste(p: string) {
    this.selectedPoste = p;
  }

  get filteredCandidatures() {
    const q = this.searchQuery.toLowerCase();

    return this.candidatures
      .filter(c =>
        (this.selectedPoste === 'Tous' || c.poste === this.selectedPoste) &&
        (
          !q ||
          c.prenom.toLowerCase().includes(q) ||
          c.nom.toLowerCase().includes(q) ||
          c.competences.some(s => s.toLowerCase().includes(q))
        )
      )
      .sort((a, b) => b.score - a.score);
  }

  /* ===== KPI ===== */

  get totalCandidats() {
    return this.filteredCandidatures.length;
  }

  get avgScore() {
    if (!this.filteredCandidatures.length) return 0;
    return Math.round(
      this.filteredCandidatures.reduce((s, c) => s + c.score, 0) /
      this.filteredCandidatures.length
    );
  }

  get topCandidats() {
    return this.filteredCandidatures.filter(c => c.score >= 85).length;
  }

  get percentTop() {
    if (!this.totalCandidats) return 0;
    return Math.round((this.topCandidats / this.totalCandidats) * 100);
  }

  /* ===== UI ===== */

  getInitials(p: string, n: string) {
    return (p[0] + n[0]).toUpperCase();
  }

  getScoreClass(score: number) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'bon';
    return 'moyen';
  }

  getScoreLabel(score: number) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Bien';
    return 'Faible';
  }
}