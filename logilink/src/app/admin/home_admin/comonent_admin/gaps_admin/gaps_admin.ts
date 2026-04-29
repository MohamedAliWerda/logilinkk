import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type ViewMode = 'cohort' | 'student';
type CategoryKey = 'tech' | 'org' | 'comp' | 'phys';

interface SkillItem {
  label: string;
  acquis: number;
  requis: number;
  status: 'Aligné' | 'Partiel' | 'Gap fort' | 'Absente';
  gap: number;
  count: number;
}

interface PriorityItem {
  label: string;
  domain: string;
  count: number;
  status: 'Aligné' | 'Partiel' | 'Gap fort' | 'Absente';
  statusClass: string;
  gap: number;
}

interface StudentItem {
  initials: string;
  name: string;
  pct: number;
  gaps: number;
  color: string;
  bg: string;
  fg: string;
}

interface StudentDetailItem extends StudentItem {
  cohortRank: number;
  marketTarget: string;
  strengths: string[];
  watchouts: string[];
  nextSteps: string[];
  skillFocus: Array<{
    label: string;
    acquis: number;
    requis: number;
    status: 'Aligné' | 'Partiel' | 'Gap fort' | 'Absente';
  }>;
}

interface JobItem {
  label: string;
  pct: number;
  tone: 'good' | 'warn' | 'alert';
}

interface ModuleItem {
  code: string;
  name: string;
  coverage: number;
  practical: number;
  color: string;
  dash: string;
}

@Component({
  selector: 'app-gaps-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gaps_admin.html',
  styleUrl: './gaps_admin.css'
})
export class GapsAdmin {
  viewMode: ViewMode = 'cohort';
  selectedCategory: CategoryKey = 'tech';
  selectedStudentIndex = 0;

  readonly kpis = [
    { label: 'Adéquation moyenne', value: '57%', note: 'objectif : 75%', tone: 'amber' },
    { label: 'Gaps critiques', value: '34', note: 'dont 8 compétences absentes', tone: 'red' },
    { label: 'Étudiants alignés', value: '4 / 18', note: '≥ 75% adéquation', tone: 'green' },
    { label: 'Gap le plus fréquent', value: 'TMS / WMS', note: '16 étudiants concernés', tone: 'blue' },
  ];

  readonly tabs: Array<{ key: CategoryKey; label: string }> = [
    { key: 'tech', label: 'Technique' },
    { key: 'org', label: 'Organisationnelle' },
    { key: 'comp', label: 'Comportementale' },
    { key: 'phys', label: 'Physique' },
  ];

  readonly skillCategories: Record<CategoryKey, SkillItem[]> = {
    tech: [
      { label: 'TMS / WMS', acquis: 31, requis: 85, status: 'Absente', gap: -54, count: 16 },
      { label: 'Data supply chain', acquis: 36, requis: 80, status: 'Absente', gap: -44, count: 14 },
      { label: 'Multimodal', acquis: 58, requis: 85, status: 'Gap fort', gap: -27, count: 11 },
      { label: 'Gestion des risques', acquis: 51, requis: 75, status: 'Gap fort', gap: -24, count: 9 },
    ],
    org: [
      { label: 'Planification', acquis: 52, requis: 80, status: 'Gap fort', gap: -28, count: 13 },
      { label: 'Suivi de projet', acquis: 43, requis: 75, status: 'Gap fort', gap: -32, count: 12 },
      { label: 'Gestion du temps', acquis: 68, requis: 85, status: 'Partiel', gap: -17, count: 8 },
      { label: 'Coordination', acquis: 57, requis: 70, status: 'Partiel', gap: -13, count: 5 },
    ],
    comp: [
      { label: 'Leadership', acquis: 53, requis: 80, status: 'Gap fort', gap: -27, count: 14 },
      { label: 'Gestion du stress', acquis: 47, requis: 75, status: 'Gap fort', gap: -28, count: 13 },
      { label: 'Adaptabilité', acquis: 62, requis: 70, status: 'Partiel', gap: -8, count: 6 },
      { label: 'Travail en équipe', acquis: 72, requis: 80, status: 'Partiel', gap: -8, count: 7 },
    ],
    phys: [
      { label: 'Endurance', acquis: 74, requis: 70, status: 'Aligné', gap: 4, count: 2 },
      { label: 'Force manuelle', acquis: 61, requis: 80, status: 'Gap fort', gap: -19, count: 10 },
      { label: 'Posture', acquis: 78, requis: 80, status: 'Partiel', gap: -2, count: 4 },
      { label: 'Dextérité', acquis: 57, requis: 75, status: 'Gap fort', gap: -18, count: 9 },
    ],
  };

  currentSkills: SkillItem[] = this.skillCategories.tech;

  readonly students: StudentItem[] = [
    { initials: 'IH', name: 'Ines H.', pct: 81, gaps: 2, color: '#2E7D32', bg: '#EBF5EB', fg: '#1B5E20' },
    { initials: 'KT', name: 'Karim T.', pct: 76, gaps: 3, color: '#2E7D32', bg: '#EBF5EB', fg: '#1B5E20' },
    { initials: 'SM', name: 'Sarra M.', pct: 74, gaps: 4, color: '#B45309', bg: '#FEF3E2', fg: '#7C3A00' },
    { initials: 'OF', name: 'Omar F.', pct: 68, gaps: 5, color: '#B45309', bg: '#FEF3E2', fg: '#7C3A00' },
    { initials: 'AB', name: 'Ali B.', pct: 57, gaps: 8, color: '#B45309', bg: '#EAF2FD', fg: '#1A4C8B' },
    { initials: 'YA', name: 'Yassine A.', pct: 43, gaps: 11, color: '#C62828', bg: '#FCEAEA', fg: '#7B1212' },
    { initials: 'NK', name: 'Nour K.', pct: 38, gaps: 13, color: '#C62828', bg: '#F3EAF9', fg: '#5E2080' },
  ];

  readonly studentDetails: StudentDetailItem[] = [
    {
      ...this.students[0],
      cohortRank: 1,
      marketTarget: 'Resp. logistique',
      strengths: ['Organisation', 'Gestion des priorités', 'Travail en équipe'],
      watchouts: ['TMS / WMS', 'Data supply chain'],
      nextSteps: ['Renforcer les outils SI', 'Préparer une mise en situation métier', 'Suivre un coaching ciblé'],
      skillFocus: [
        { label: 'TMS / WMS', acquis: 62, requis: 85, status: 'Partiel' },
        { label: 'Planification', acquis: 78, requis: 80, status: 'Aligné' },
        { label: 'Leadership', acquis: 70, requis: 80, status: 'Partiel' },
        { label: 'Gestion du stress', acquis: 74, requis: 75, status: 'Aligné' },
      ],
    },
    {
      ...this.students[1],
      cohortRank: 2,
      marketTarget: 'Supply chain analyst',
      strengths: ['Analyse', 'Coordination', 'Suivi de projet'],
      watchouts: ['Data supply chain', 'Multimodal'],
      nextSteps: ['Travailler les données', 'Ajouter un mini-projet analytique', 'Répéter les cas métier'],
      skillFocus: [
        { label: 'Data supply chain', acquis: 58, requis: 80, status: 'Partiel' },
        { label: 'Suivi de projet', acquis: 66, requis: 75, status: 'Partiel' },
        { label: 'Multimodal', acquis: 72, requis: 85, status: 'Partiel' },
        { label: 'Gestion du temps', acquis: 82, requis: 85, status: 'Partiel' },
      ],
    },
    {
      ...this.students[2],
      cohortRank: 3,
      marketTarget: 'Chef de projet TL',
      strengths: ['Organisation', 'Adaptabilité', 'Suivi'],
      watchouts: ['Leadership', 'TMS / WMS'],
      nextSteps: ['Clarifier la trajectoire métier', 'Travailler la posture de pilotage', 'Construire un portfolio'],
      skillFocus: [
        { label: 'Leadership', acquis: 63, requis: 80, status: 'Partiel' },
        { label: 'Coordination', acquis: 70, requis: 70, status: 'Aligné' },
        { label: 'Adaptabilité', acquis: 68, requis: 70, status: 'Partiel' },
        { label: 'Gestion du stress', acquis: 60, requis: 75, status: 'Partiel' },
      ],
    },
    {
      ...this.students[3],
      cohortRank: 4,
      marketTarget: 'Coordinateur I/E',
      strengths: ['Rigueur', 'Sens du process', 'Coordination'],
      watchouts: ['Réglementation', 'Data supply chain'],
      nextSteps: ['Renforcer la réglementation import-export', 'Faire des exercices terrain', 'Valider les acquis SI'],
      skillFocus: [
        { label: 'Coordination', acquis: 60, requis: 70, status: 'Partiel' },
        { label: 'Multimodal', acquis: 54, requis: 85, status: 'Gap fort' },
        { label: 'TMS / WMS', acquis: 41, requis: 85, status: 'Gap fort' },
        { label: 'Gestion des risques', acquis: 49, requis: 75, status: 'Partiel' },
      ],
    },
  ];

  readonly priorityItems: PriorityItem[] = [
    { label: 'TMS / WMS', domain: 'Technique', count: 16, status: 'Absente', statusClass: 'status-absente', gap: 54 },
    { label: 'Data supply chain', domain: 'Technique', count: 14, status: 'Absente', statusClass: 'status-absente', gap: 44 },
    { label: 'Leadership', domain: 'Comportementale', count: 14, status: 'Gap fort', statusClass: 'status-gap', gap: 27 },
    { label: 'Planification', domain: 'Organisationnelle', count: 13, status: 'Gap fort', statusClass: 'status-gap', gap: 28 },
    { label: 'Gestion du stress', domain: 'Comportementale', count: 13, status: 'Gap fort', statusClass: 'status-gap', gap: 28 },
  ];

  readonly jobFit: JobItem[] = [
    { label: 'Resp. logistique', pct: 71, tone: 'good' },
    { label: 'Supply chain analyst', pct: 63, tone: 'warn' },
    { label: 'Chef de projet TL', pct: 60, tone: 'warn' },
    { label: 'Coordinateur I/E', pct: 48, tone: 'alert' },
    { label: 'Consultant TMS', pct: 35, tone: 'alert' },
  ];

  readonly modules: ModuleItem[] = [
    { code: 'LOG101', name: 'Fondamentaux', coverage: 55, practical: 25, color: this.coverageColor(55), dash: this.dashArray(55) },
    { code: 'TRA201', name: 'Multimodal', coverage: 72, practical: 40, color: this.coverageColor(72), dash: this.dashArray(72) },
    { code: 'GES301', name: 'Opérations', coverage: 48, practical: 20, color: this.coverageColor(48), dash: this.dashArray(48) },
    { code: 'INF203', name: 'SI logistiques', coverage: 80, practical: 50, color: this.coverageColor(80), dash: this.dashArray(80) },
    { code: 'ECO102', name: 'Économie TL', coverage: 38, practical: 10, color: this.coverageColor(38), dash: this.dashArray(38) },
  ];

  readonly statusClasses: Record<SkillItem['status'], string> = {
    'Aligné': 'status-aligne',
    'Partiel': 'status-partiel',
    'Gap fort': 'status-gap',
    'Absente': 'status-absente',
  };

  setCategory(key: CategoryKey): void {
    this.selectedCategory = key;
    this.currentSkills = this.skillCategories[key];
  }

  setViewMode(value: ViewMode): void {
    this.viewMode = value;
  }

  setStudent(index: number): void {
    this.selectedStudentIndex = index;
  }

  get selectedStudent(): StudentDetailItem {
    return this.studentDetails[this.selectedStudentIndex];
  }

  statusClassFor(status: SkillItem['status']): string {
    return this.statusClasses[status];
  }

  coverageColor(value: number): string {
    if (value >= 75) {
      return '#2E7D32';
    }

    if (value >= 60) {
      return '#B45309';
    }

    return '#C62828';
  }

  dashArray(value: number): string {
    const radius = 20;
    const circumference = 2 * Math.PI * radius;
    const drawn = (circumference * value) / 100;
    return `${drawn.toFixed(1)} ${circumference.toFixed(1)}`;
  }
}
