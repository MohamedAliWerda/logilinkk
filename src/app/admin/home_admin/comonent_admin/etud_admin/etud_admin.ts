import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

interface Student {
  id: string;
  fullName: string;
  filiere: string;
  scoreAts: number;
  scoreEmployability: number;
  scoreEmployabilityRaw?: string;
}

interface DashboardStudentResponse {
  id: string;
  authId: string;
  name: string;
  speciality: string;
  score: number;
  employabilityScore: number;
  employabilityScoreRaw?: string;
}

@Component({
  selector: 'app-etud-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './etud_admin.html',
  styleUrl: './etud_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EtudAdmin implements OnInit {
  searchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  loading = false;
  errorMessage: string | null = null;

  students: Student[] = [];

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    void this.loadStudents();
  }

  async loadStudents(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      const url = `${environment.apiUrl}/admin/dashboard/students?limit=500`;
      const response = await firstValueFrom(
        this.http.get<{ data?: DashboardStudentResponse[] } | DashboardStudentResponse[]>(url),
      );
      const rows = Array.isArray(response)
        ? response
        : (response as { data?: DashboardStudentResponse[] })?.data ?? [];
      this.students = (rows ?? []).map((row) => this.mapStudent(row));
    } catch (err) {
      console.error('Failed to load students:', err);
      this.errorMessage = 'Impossible de charger la liste des étudiants.';
      this.students = [];
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private mapStudent(row: DashboardStudentResponse): Student {
    const scoreAts = Number(row?.score ?? 0);
    const scoreEmployability = Number(row?.employabilityScore ?? 0);
    const scoreEmployabilityRaw = row?.employabilityScoreRaw != null ? String(row.employabilityScoreRaw) : undefined;
    return {
      id: String(row?.id ?? '').trim() || row?.authId || '',
      fullName: String(row?.name ?? '').trim() || 'Étudiant',
      filiere: String(row?.speciality ?? '').trim() || 'Non renseignée',
      scoreAts,
      scoreEmployability,
      scoreEmployabilityRaw,
    };
  }

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

  trackById(index: number, item: Student): string {
    return item.id;
  }
}
