import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface OldStudent {
  id: string;
  fullName: string;
  email: string;
  promotion: number;
  status: 'À répondu' | 'Non contacté' | 'Invité';
  company?: string;
  position?: string;
  rating?: number;
  competenceFeedback?: string[];
  feedbackDate?: string;
}

interface StatCard {
  value: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-feedback-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback_admin.html',
  styleUrl: './feedback_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackAdmin {
  searchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  activeTab: 'anciens' | 'retours' = 'anciens';

  showProfileModal: boolean = false;
  selectedStudent: OldStudent | null = null;

  oldStudents: OldStudent[] = [
    {
      id: 'ISGI2021-001',
      fullName: 'Ahmed Benali',
      email: 'ahmed.benali@gmail.com',
      promotion: 2021,
      status: 'À répondu',
      company: 'Maersk Tunisie',
      position: 'Responsable logistique',
      rating: 5,
      competenceFeedback: ['Gestion d\'entrepôt WMS', 'SAP/ERP Logistique', 'Planification transport'],
      feedbackDate: '2025-03-15',
    },
    {
      id: 'ISGI2021-002',
      fullName: 'Fatima Zahra Mansouri',
      email: 'fatima.m@outlook.com',
      promotion: 2022,
      status: 'À répondu',
      company: 'DHL Sfax',
      position: 'Coordinatrice transport',
      rating: 4,
      competenceFeedback: ['Planification transport', 'Négociation fournisseurs', 'Power BI'],
      feedbackDate: '2025-03-10',
    },
    {
      id: 'ISGI2020-003',
      fullName: 'Youssef Alami',
      email: 'youssef.alami@yahoo.fr',
      promotion: 2020,
      status: 'Non contacté',
    },
    {
      id: 'ISGI2021-004',
      fullName: 'Sarra Gharbi',
      email: 'sarra.gharbi@gmail.com',
      promotion: 2021,
      status: 'Invité',
    },
    {
      id: 'ISGI2022-005',
      fullName: 'Ines Khelifi',
      email: 'ines.khelifi@email.com',
      promotion: 2022,
      status: 'À répondu',
      company: 'Geodis',
      position: 'Supply Chain Analyst',
      rating: 5,
      competenceFeedback: ['Optimisation des coûts', 'Pilotage KPI supply', 'Power BI'],
      feedbackDate: '2025-03-08',
    },
    {
      id: 'ISGI2021-006',
      fullName: 'Mohamed Karray',
      email: 'm.karray@company.tn',
      promotion: 2021,
      status: 'À répondu',
      company: 'Bolloré Transport & Logistics',
      position: 'Assistant Demand Planner',
      rating: 4,
      competenceFeedback: ['Planification transport', 'Data visualisation', 'Gestion d\'entrepôt WMS'],
      feedbackDate: '2025-02-28',
    },
  ];

  get stats(): StatCard[] {
    const responded = this.oldStudents.filter(s => s.status === 'À répondu').length;
    const invited = this.oldStudents.filter(s => s.status === 'Invité').length;
    const avgRating = this.oldStudents.filter(s => s.rating).reduce((sum, s) => sum + (s.rating || 0), 0) / 
                      this.oldStudents.filter(s => s.rating).length || 0;

    return [
      { value: this.oldStudents.length.toString(), label: 'Anciens recensés' },
      { value: invited.toString(), label: 'Invitations envoyées' },
      { value: responded.toString(), label: 'Réponses reçues' },
      { value: avgRating.toFixed(1) + '/5', label: 'Note moyenne' },
    ];
  }

  get filteredStudents(): OldStudent[] {
    let filtered = this.oldStudents.filter(s => {
      const matchTab = this.activeTab === 'anciens' || (this.activeTab === 'retours' && s.status === 'À répondu');
      const matchSearch = !this.searchTerm.trim() ||
        s.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchTab && matchSearch;
    });

    if (this.sortColumn) {
      filtered.sort((a, b) => {
        const valA = (a as any)[this.sortColumn];
        const valB = (b as any)[this.sortColumn];

        let comparison = 0;
        if (typeof valA === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number') {
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

  setActiveTab(tab: 'anciens' | 'retours') {
    this.activeTab = tab;
    this.sortColumn = '';
    this.searchTerm = '';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'À répondu':
        return 'status-responded';
      case 'Non contacté':
        return 'status-not-contacted';
      case 'Invité':
        return 'status-invited';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'À répondu':
        return '✓';
      case 'Invité':
        return '✉';
      default:
        return '○';
    }
  }

  renderStars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  viewProfile(studentId: string): void {
    const student = this.oldStudents.find(s => s.id === studentId);
    if (student) {
      this.selectedStudent = student;
      this.showProfileModal = true;
    }
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedStudent = null;
  }

  sendInvitation(studentId: string): void {
    const student = this.oldStudents.find(s => s.id === studentId);
    if (student && student.status === 'Non contacté') {
      student.status = 'Invité';
      alert(`Invitation envoyée à ${student.fullName}`);
    }
  }

  deleteStudent(studentId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet ancien diplômé ?')) {
      this.oldStudents = this.oldStudents.filter(s => s.id !== studentId);
    }
  }

  trackById(index: number, item: OldStudent): string {
    return item.id;
  }
}
