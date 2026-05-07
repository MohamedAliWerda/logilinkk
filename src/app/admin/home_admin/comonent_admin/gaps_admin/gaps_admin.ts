import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

type ViewMode = 'cohort' | 'student';
type SkillStatus = 'Aligné' | 'Partiel' | 'Gap fort' | 'Insuffisante';

interface SkillItem {
  label: string;
  acquis: number;
  requis: number;
  status: SkillStatus;
  gap: number;
  count: number;
}

interface PriorityItem {
  label: string;
  domain: string;
  count: number;
  status: SkillStatus;
  statusClass: string;
  gap: number;
}

interface StudentItem {
  authId: string;
  initials: string;
  name: string;
  pct: number;
  gaps: number;
  color: string;
  bg: string;
  fg: string;
  marketTarget: string;
  cohortRank: number;
  filiere: string;
  diplome: string;
}

interface StudentDetailItem extends StudentItem {
  strengths: string[];
  watchouts: string[];
  nextSteps: string[];
  skillFocus: Array<{
    label: string;
    acquis: number;
    requis: number;
    status: SkillStatus;
  }>;
}

interface JobItem {
  label: string;
  pct: number;
  tone: 'good' | 'warn' | 'alert';
}

interface CategoryDescriptor {
  key: string;
  label: string;
}

interface GapsDashboardPayload {
  cohortLabel: string;
  totalStudents: number;
  kpis: Array<{ label: string; value: string; note: string; tone: string }>;
  tabs: CategoryDescriptor[];
  skillCategories: Record<string, SkillItem[]>;
  students: StudentItem[];
  studentDetails: StudentDetailItem[];
  priorityItems: PriorityItem[];
  jobFit: JobItem[];
}

@Component({
  selector: 'app-gaps-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gaps_admin.html',
  styleUrl: './gaps_admin.css'
})
export class GapsAdmin implements OnInit {
  viewMode: ViewMode = 'cohort';
  selectedCategory = '';
  selectedStudentIndex = 0;
  filterFiliere = '';
  filterDiplome = '';
  showAllStudents = false;

  loading = true;
  errorMessage: string | null = null;

  cohortLabel = '';
  totalStudents = 0;
  kpis: Array<{ label: string; value: string; note: string; tone: string }> = [];
  tabs: CategoryDescriptor[] = [];
  skillCategories: Record<string, SkillItem[]> = {};
  currentSkills: SkillItem[] = [];
  students: StudentItem[] = [];
  studentDetails: StudentDetailItem[] = [];
  priorityItems: PriorityItem[] = [];
  jobFit: JobItem[] = [];

  readonly statusClasses: Record<SkillStatus, string> = {
    'Aligné': 'status-aligne',
    'Partiel': 'status-partiel',
    'Gap fort': 'status-gap',
    'Insuffisante': 'status-absente',
  };

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    void this.loadDashboard();
  }

  async loadDashboard(): Promise<void> {
    this.loading = true;
    this.errorMessage = null;
    try {
      const url = `${environment.apiUrl}/admin/gaps`;
      const response = await firstValueFrom(this.http.get<{ data?: GapsDashboardPayload } | GapsDashboardPayload>(url));
      const payload = (response as { data?: GapsDashboardPayload })?.data ?? (response as GapsDashboardPayload);
      this.applyPayload(payload);
    } catch (err) {
      console.error('Failed to load gaps dashboard:', err);
      this.errorMessage = 'Impossible de charger les données pour le moment.';
      this.applyPayload(this.emptyPayload());
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private applyPayload(payload: GapsDashboardPayload): void {
    this.cohortLabel = payload.cohortLabel;
    this.totalStudents = payload.totalStudents;
    this.kpis = payload.kpis ?? [];
    this.tabs = payload.tabs ?? [];
    this.skillCategories = payload.skillCategories ?? {};
    this.students = payload.students ?? [];
    this.studentDetails = payload.studentDetails ?? [];
    this.priorityItems = payload.priorityItems ?? [];
    this.jobFit = payload.jobFit ?? [];

    const firstTab = this.tabs[0];
    this.selectedCategory = firstTab ? firstTab.key : '';
    this.currentSkills = firstTab ? this.skillCategories[firstTab.key] ?? [] : [];

    this.selectedStudentIndex = 0;
  }

  private emptyPayload(): GapsDashboardPayload {
    return {
      cohortLabel: '',
      totalStudents: 0,
      kpis: [],
      tabs: [],
      skillCategories: {},
      students: [],
      studentDetails: [],
      priorityItems: [],
      jobFit: [],
    };
  }

  setCategory(key: string): void {
    this.selectedCategory = key;
    this.currentSkills = this.skillCategories[key] ?? [];
  }

  setViewMode(value: ViewMode): void {
    this.viewMode = value;
  }

  setStudent(index: number): void {
    if (index < 0 || index >= this.studentDetails.length) {
      return;
    }
    this.selectedStudentIndex = index;
  }

  get uniqueFilieres(): string[] {
    return [...new Set(this.studentDetails.map(s => s.filiere).filter(f => !!f))].sort();
  }

  get filteredStudentDetails(): StudentDetailItem[] {
    return this.studentDetails.filter(s => {
      const matchFiliere = !this.filterFiliere || s.filiere === this.filterFiliere;
      const matchDiplome = !this.filterDiplome || s.diplome === this.filterDiplome;
      return matchFiliere && matchDiplome;
    });
  }

  get selectedStudent(): StudentDetailItem | null {
    return this.studentDetails[this.selectedStudentIndex] ?? null;
  }

  statusClassFor(status: SkillStatus): string {
    return this.statusClasses[status] ?? '';
  }
}
