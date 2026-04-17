import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Student {
  id: string;
  fullName: string;
  filiere: string;
  scoreAts: number;
  scoreEmployability: number;
  scoreSynergie: number;
  matchings: string[];
  gaps: string[];
  recommendations: string[];
}

interface Alumni {
  id: string;
  fullName: string;
  filiere: string;
  company: string;
  jobTitle: string;
  email: string;
  employedSince: string;
}

@Component({
  selector: 'app-etud-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './etud_admin.html',
  styleUrl: './etud_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtudAdmin {
  searchTerm: string = '';
  alumniSearchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  showProfileModal: boolean = false;
  selectedStudent: Student | null = null;

  students: Student[] = [
    { 
      id: 'ISGI2025-042', 
      fullName: 'Ahmed Ben Ali', 
      filiere: 'Logistique', 
      scoreAts: 85, 
      scoreEmployability: 81, 
      scoreSynergie: 92,
      matchings: ['Coordinateur Supply Chain', 'Analyste Flux Logistiques'],
      gaps: ['Optimisation KPI transport', 'Gestion avancée WMS'],
      recommendations: ['Atelier KPI Logistique', "Projet terrain d'entrepôt"]
    },
    { 
      id: '2024002', 
      fullName: 'Sarra Mansour', 
      filiere: 'Transit & Douane', 
      scoreAts: 92, 
      scoreEmployability: 88, 
      scoreSynergie: 85,
      matchings: ['Responsable Transit', 'Déclarant en Douane'],
      gaps: ['Règlementation phytosanitaire', 'Anglais technique'],
      recommendations: ['Certification Douane niv.2', 'Formation linguistique']
    },
    { 
      id: '2024003', 
      fullName: 'Mohamed Ali Trabelsi', 
      filiere: 'Transport Maritime', 
      scoreAts: 78, 
      scoreEmployability: 82, 
      scoreSynergie: 80,
      matchings: ['Agent de Consignation', 'Planning Opérations'],
      gaps: ['Logiciels de gestion portuaire', 'Gestion des litiges'],
      recommendations: ['Stage portuaire Sfax', 'Webinaire Incoterms']
    },
    { 
      id: '2024004', 
      fullName: 'Ines Khemiri', 
      filiere: 'Supply Chain Management', 
      scoreAts: 88, 
      scoreEmployability: 90, 
      scoreSynergie: 88,
      matchings: ['Supply Chain Planner', 'Consultant Logistique'],
      gaps: ['Expertise Excel avancée', 'Outils BI'],
      recommendations: ['Atelier Power BI', 'Projet Lean Six Sigma']
    }
  ];

  employedAlumni: Alumni[] = [
    {
      id: 'ALM-2022-011',
      fullName: 'Youssef Mzoughi',
      filiere: 'Supply Chain Management',
      company: 'CMA CGM Tunisia',
      jobTitle: 'Supply Planner',
      email: 'youssef.mzoughi@example.com',
      employedSince: '2023-02-12'
    },
    {
      id: 'ALM-2021-034',
      fullName: 'Meriem Karray',
      filiere: 'Transit & Douane',
      company: 'Bollore Logistics',
      jobTitle: 'Transit Specialist',
      email: 'meriem.karray@example.com',
      employedSince: '2022-09-01'
    },
    {
      id: 'ALM-2020-007',
      fullName: 'Anis Gharbi',
      filiere: 'Transport Maritime',
      company: 'OMMP',
      jobTitle: 'Operations Officer',
      email: 'anis.gharbi@example.com',
      employedSince: '2021-06-20'
    }
  ];

  get filteredStudents(): Student[] {
    let filtered = this.students.filter(s => {
      const matchSearch = !this.searchTerm.trim() || 
        s.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) || 
        s.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.filiere.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      return matchSearch;
    });

    if (this.sortColumn) {
      filtered.sort((a, b) => {
        const valA = (a as any)[this.sortColumn];
        const valB = (b as any)[this.sortColumn];
        
        let comparison = 0;
        if (typeof valA === 'string') {
          comparison = valA.localeCompare(valB);
        } else {
          comparison = valA - valB;
        }
        
        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }

  get filteredEmployedAlumni(): Alumni[] {
    const search = this.alumniSearchTerm.trim().toLowerCase();

    if (!search) {
      return this.employedAlumni;
    }

    return this.employedAlumni.filter((alumni) =>
      alumni.fullName.toLowerCase().includes(search) ||
      alumni.id.toLowerCase().includes(search) ||
      alumni.filiere.toLowerCase().includes(search) ||
      alumni.company.toLowerCase().includes(search) ||
      alumni.jobTitle.toLowerCase().includes(search)
    );
  }

  setSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  viewProfile(studentId: string): void {
    const student = this.students.find(s => s.id === studentId);
    if (student) {
      this.selectedStudent = student;
      this.showProfileModal = true;
    }
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedStudent = null;
  }

  trackById(index: number, item: Student): string {
    return item.id;
  }

  trackByAlumniId(index: number, item: Alumni): string {
    return item.id;
  }

  buildAlumniEmailLink(alumni: Alumni): string {
    const subject = encodeURIComponent('Suivi ancien etudiant - Inserat');
    const body = encodeURIComponent(
      `Bonjour ${alumni.fullName},\n\n` +
      'Nous esperons que tout se passe bien dans votre poste actuel.\n' +
      'Pourriez-vous nous partager un retour rapide sur votre insertion professionnelle ' +
      'et les competences les plus utiles acquises durant votre parcours ?\n\n' +
      'Merci pour votre retour.\n\n' +
      'Equipe Inserat'
    );

    return `mailto:${alumni.email}?subject=${subject}&body=${body}`;
  }

  buildBulkAlumniEmailLink(): string {
    const emails = this.employedAlumni
      .map((alumni) => alumni.email.trim())
      .filter((email) => email.length > 0)
      .join(';');

    const subject = encodeURIComponent('Suivi insertion professionnelle - anciens etudiants');
    const body = encodeURIComponent(
      'Bonjour,\n\n' +
      'Nous vous contactons pour recueillir un retour sur votre insertion professionnelle ' +
      'et sur les competences les plus utiles dans votre poste actuel.\n\n' +
      'Merci pour votre aide.\n\n' +
      'Equipe Inserat'
    );

    return `mailto:?bcc=${emails}&subject=${subject}&body=${body}`;
  }
}
