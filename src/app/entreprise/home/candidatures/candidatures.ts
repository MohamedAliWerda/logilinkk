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
  selectedPoste = 'Tous';

  postes = [
    'Tous',
    'Développeur Full Stack',
    'UX Designer',
    'Data Analyst'
  ];

  candidatures = [
    {
      prenom: 'Amira', nom: 'Belhassen',
      email: 'amira@email.com',
      ville: 'Tunis', timeAgo: '2j',
      score: 92, scoreATS: null,
      poste: 'Développeur Full Stack',
      competences: ['React', 'Node.js', 'PostgreSQL'],
    },
    {
      prenom: 'Karim', nom: 'Bouaziz',
      email: 'karim@email.com',
      ville: 'Sfax', timeAgo: '3j',
      score: 91, scoreATS: null,
      poste: 'Développeur Full Stack',
      competences: ['Vue.js', 'Laravel', 'MySQL'],
    },
    {
      prenom: 'Nour', nom: 'Trabelsi',
      email: 'nour@email.com',
      ville: 'Tunis', timeAgo: '1j',
      score: 74, scoreATS: null,
      poste: 'Développeur Full Stack',
      competences: ['Angular', 'Spring Boot'],
    },
    {
      prenom: 'Ines', nom: 'Gharbi',
      email: 'ines@email.com',
      ville: 'Sousse', timeAgo: '5j',
      score: 88, scoreATS: null,
      poste: 'UX Designer',
      competences: ['Figma', 'Adobe XD', 'Prototypage'],
    },
    {
      prenom: 'Sarra', nom: 'Mansouri',
      email: 'sarra@email.com',
      ville: 'Tunis', timeAgo: '1j',
      score: 78, scoreATS: null,
      poste: 'UX Designer',
      competences: ['Angular', 'MongoDB'],
    },
    {
      prenom: 'Yassine', nom: 'Hamdi',
      email: 'yassine@email.com',
      ville: 'Tunis', timeAgo: '2j',
      score: 95, scoreATS: null,
      poste: 'Data Analyst',
      competences: ['Python', 'Power BI', 'SQL'],
    },
    {
      prenom: 'Mehdi', nom: 'Khaled',
      email: 'mehdi@email.com',
      ville: 'Sfax', timeAgo: '4j',
      score: 85, scoreATS: null,
      poste: 'Data Analyst',
      competences: ['Python', 'Docker'],
    },
    {
      prenom: 'Mariem', nom: 'Saadi',
      email: 'mariem@email.com',
      ville: 'Bizerte', timeAgo: '6j',
      score: 69, scoreATS: null,
      poste: 'Data Analyst',
      competences: ['Excel', 'Tableau', 'R'],
    }
  ];

  setPoste(p: string): void {
    this.selectedPoste = p;
  }

  get filteredCandidatures() {
    const q = this.searchQuery.toLowerCase();
    return this.candidatures
      .filter(c =>
        (this.selectedPoste === 'Tous' || c.poste === this.selectedPoste) &&
        (!q ||
          c.prenom.toLowerCase().includes(q) ||
          c.nom.toLowerCase().includes(q) ||
          c.competences.some(s => s.toLowerCase().includes(q))
        )
      )
      .sort((a, b) => b.score - a.score);
  }

  // ✅ Grouper par poste pour le mode "Tous"
  get groupedCandidatures(): { poste: string; candidats: any[] }[] {
    const q = this.searchQuery.toLowerCase();
    const allSorted = this.candidatures
      .filter(c =>
        !q ||
        c.prenom.toLowerCase().includes(q) ||
        c.nom.toLowerCase().includes(q) ||
        c.competences.some(s => s.toLowerCase().includes(q))
      )
      .sort((a, b) => b.score - a.score);

    const groups: { [key: string]: any[] } = {};
    for (const c of allSorted) {
      if (!groups[c.poste]) groups[c.poste] = [];
      groups[c.poste].push(c);
    }

    return Object.keys(groups).map(poste => ({
      poste,
      candidats: groups[poste]
    }));
  }

  get totalCandidats(): number {
    return this.filteredCandidatures.length;
  }

  get avgScore(): number {
    if (!this.filteredCandidatures.length) return 0;
    return Math.round(
      this.filteredCandidatures.reduce((s, c) => s + c.score, 0) /
      this.filteredCandidatures.length
    );
  }

  // ✅ top = score >= 90
  get topCandidats(): number {
    return this.filteredCandidatures.filter(c => c.score >= 90).length;
  }

  get percentTop(): number {
    if (!this.totalCandidats) return 0;
    return Math.round((this.topCandidats / this.totalCandidats) * 100);
  }

  getInitials(p: string, n: string): string {
    return (p[0] + n[0]).toUpperCase();
  }

  getScoreClass(score: number): string {
    if (score >= 89) return 'excellent';
    if (score >= 70) return 'bon';
    if (score >= 60) return 'moyen';
    return 'faible';
  }

  getScoreLabel(score: number): string {
    if (score >= 89) return 'Excellent';
    if (score >= 70) return 'Bien';
    return 'Faible';
  }
}