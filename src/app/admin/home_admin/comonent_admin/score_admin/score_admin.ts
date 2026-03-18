import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type FiliereStat = {
  filiere: string;
  score: number;
};

type NiveauStat = {
  niveau: string;
  score: number;
};

@Component({
  selector: 'app-score-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score_admin.html',
  styleUrl: './score_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreAdmin {

  /* ── 1. Score général ─────────────────────────────────── */
  readonly scoreGeneral = 72;
  readonly scoreGradient = 'conic-gradient(#f4a23b 0% 72%, #eceff4 72% 100%)';
  readonly scoreLabel = 'Bon';

  /* ── 2. Score par filière ─────────────────────────────── */
  readonly filiereStats: FiliereStat[] = [
    { filiere: 'Licence Nationale en Génie Logistique: Logistique Industrielle', score: 74 },
    { filiere: 'Licence Nationale en Sciences de Transport: Planification et Organisation des Transports', score: 68 },
    { filiere: 'Master Professionnel Génie Industriel et Logistique', score: 81 },
    { filiere: 'Mastère de Recherche en Économie Quantitative: Sciences des Transports et Logistique (STL)', score: 77 },
  ];

  /* ── 3. Distribution par niveau (Score Employabilité 0-100%) ── */
  readonly niveauStats: NiveauStat[] = [
    { niveau: '3ème Licence',              score: 78 },
    { niveau: '2ème Licence',              score: 65 },
    { niveau: '1ère Licence',              score: 42 },
    { niveau: '2ème Master Pro',           score: 85 },
    { niveau: '1ère Master Pro',           score: 72 },
    { niveau: '2ème Mastère Rech.',        score: 88 },
    { niveau: '1ère Mastère Rech.',        score: 75 },
  ];

  /** Full labels used in tooltips */
  readonly niveauFullLabels: Record<string, string> = {
    '3ème Licence':       '3ème Licence',
    '2ème Licence':       '2ème Licence',
    '1ère Licence':       '1ère Licence',
    '2ème Master Pro':    '2ème Master professionnel',
    '1ère Master Pro':    '1ère Master professionnel',
    '2ème Mastère Rech.': '2ème Mastère de recherche',
    '1ère Mastère Rech.': '1ère Mastère de recherche',
  };

  readonly yMax = 100;
  readonly yGridLines = [0, 25, 50, 75, 100];
  readonly yGridLinesReversed = [...this.yGridLines].reverse();
  readonly yGridLinesInner   = this.yGridLines.slice(1).reverse();

  /* ── helpers ─────────────────────────────────────────── */
  scoreClass(score: number): string {
    if (score >= 75) return 'chip chip-good';
    if (score >= 55) return 'chip chip-mid';
    return 'chip chip-low';
  }

  niveauBarPct(score: number): number {
    return (score / this.yMax) * 100;
  }

  gridLinePct(g: number): number {
    return (g / this.yMax) * 100;
  }

  trackByFiliere(_: number, f: FiliereStat): string { return f.filiere; }
  trackByNiveau(_: number, n: NiveauStat): string   { return n.niveau;  }
  trackByGrid(_: number, g: number): number          { return g; }
}
