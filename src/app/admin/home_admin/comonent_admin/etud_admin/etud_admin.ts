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
}
