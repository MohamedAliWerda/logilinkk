import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';

// ═════════════════════════════════════════════════════════════════════════════
//  BACKEND INTEGRATION GUIDE
// ═════════════════════════════════════════════════════════════════════════════
/**
 * This component displays the official student transcript (Relevé de Notes).
 *
 * It is currently running in PREVIEW MODE, which means all data is hard-coded
 * for frontend layout testing and NO API calls are made.
 *
 * ─── When you are ready to connect the backend ───────────────────────────────
 *
 * Step 1 — Set `previewMode = false` in this file.
 *
 * Step 2 — Inject your service in the constructor:
 *   constructor(private transcriptService: TranscriptService) {}
 *
 * Step 3 — Implement ngOnInit() to load data from the API:
 *   ngOnInit(): void {
 *     this.transcriptService.getStudentProfile().subscribe(data => {
 *       this.studentInfo = data;
 *     });
 *     this.transcriptService.getModules().subscribe(data => {
 *       this.modules = data;
 *     });
 *     this.transcriptService.getTranscriptSummary().subscribe(data => {
 *       this.backendSummary = data;
 *     });
 *   }
 *
 * ─── Expected API endpoints ──────────────────────────────────────────────────
 *
 *   GET /student/profile
 *     → Returns: StudentInfo
 *     → Provides all personal/academic identity fields shown in the header card.
 *
 *   GET /student/modules?semester=1   (or semester=2)
 *     → Returns: ModuleGrade[]
 *     → Provides the list of modules with grades for the requested semester.
 *     → Grades (cc, examen, moyenne) may be null if not yet published.
 *
 *   GET /student/transcript-summary
 *     → Returns: TranscriptSummary
 *     → Provides computed averages, credit totals, and jury decision.
 *     → Only meaningful once Semester 2 grades are published.
 *
 * ─── Three application states this component must handle ────────────────────
 *
 *   STATE 1 — PREVIEW MODE (current)
 *     previewMode = true
 *     No API calls are made. All data is loaded from the static preview blocks
 *     at the bottom of this file. Used for frontend layout testing only.
 *     → To activate: keep previewMode = true (default).
 *     → To deactivate: set previewMode = false and implement ngOnInit().
 *
 *   STATE 2 — BACKEND CONNECTED, GRADES NOT YET PUBLISHED
 *     previewMode = false
 *     studentInfo and modules are loaded from the backend.
 *     However, cc / examen / moyenneModule fields arrive as null.
 *     The table still renders fully — student card and module list are shown —
 *     but the grade columns (CC, Examen, Moyenne) display "–".
 *     The summary table shows "–" for all averages and credits.
 *     → This state is handled automatically by the null-checks in the template.
 *
 *   STATE 3 — BACKEND CONNECTED, GRADES PUBLISHED
 *     previewMode = false
 *     All fields in ModuleGrade are populated with real values.
 *     Averages and jury decision are computed/received from the backend.
 *     The page renders a complete official transcript.
 */


// ═════════════════════════════════════════════════════════════════════════════
//  DATA MODELS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * StudentInfo — personal and academic identity of the student.
 *
 * Source API: GET /student/profile
 *
 * Fields:
 *   nom              — family name in uppercase (e.g. "ZGHAL")
 *   prenom           — first name (e.g. "BILEL")
 *   dateNaissance    — date of birth formatted DD/MM/YYYY
 *   lieuNaissance    — city of birth
 *   cin              — national identity card number
 *   numInscription   — institutional registration number
 *   situation        — student status (e.g. "Nouveau", "Redoublant")
 *   diplome          — full name of the degree being pursued
 *   specialite       — programme specialisation (e.g. "Business Intelligence")
 *   niveau           — current study year (e.g. "Deuxième Année")
 *   institution      — name of the institution (used in stamp area)
 */
export interface StudentInfo {
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  cin: string;
  numInscription: string;
  situation: string;
  diplome: string;
  specialite: string;
  niveau: string;
  institution: string;
}

/**
 * ModuleInfo — static catalogue information about a module.
 *
 * This interface describes the module itself (independent of a student's grades).
 * Source API: GET /student/modules
 *
 * Fields:
 *   codeModule   — short identifier used in official documents (e.g. "B26")
 *   moduleName   — full official name of the module (never abbreviated)
 *   semester     — which semester this module belongs to: 1 or 2
 *   coefficient  — weighting factor used in average calculations
 *   credit       — ECTS credit value awarded upon validation
 */
export interface ModuleInfo {
  codeModule: string;
  moduleName: string;
  semester: 1 | 2;
  coefficient: number;
  credit: number;
}

/**
 * ModuleGrade — extends ModuleInfo with the student's grade data.
 *
 * Source API: GET /student/modules?semester=1 (or 2)
 *
 * Grades may be null in two cases:
 *   1. The grades session has not been entered yet (backend returns null).
 *   2. The module has no exam — only continuous assessment applies.
 *
 * Fields:
 *   contrContinu   — continuous assessment grade (CC), or null if not entered
 *   examen         — written exam grade, or null if not applicable / not entered
 *   moyenneModule  — final module average, or null if grades are not published
 *
 * The template uses null-checks to display "–" when values are absent:
 *   {{ grade.contrContinu !== null ? grade.contrContinu : '–' }}
 *
 * ─── STATE 2 behaviour (grades not published) ────────────────────────────────
 * When the backend returns modules but all grade fields are null, the table
 * will automatically show "–" in the CC, Examen, and Moyenne columns.
 * The student card and module list remain fully visible.
 * No empty-state message is shown because modules[] is not empty.
 */
export interface ModuleGrade extends ModuleInfo {
  contrContinu: number | null;
  examen: number | null;
  moyenneModule: number | null;
}

/**
 * DecisionJury — the possible jury verdict values.
 *
 * 'Admis'    — student passed and is promoted to the next year
 * 'Contrôle' — student must sit a supplementary exam (rattrapage)
 * 'Refusé'   — student has failed and must repeat the year
 * '-'        — no decision available yet (Semester 1 view, or not published)
 *
 * Source API: GET /student/transcript-summary → field decisionJury
 */
export type DecisionJury = 'Admis' | 'Contrôle' | 'Refusé' | '-';

/**
 * TranscriptSummary — the aggregated result block shown at the bottom.
 *
 * Source API: GET /student/transcript-summary
 *
 * This object is only fully meaningful at the end of Semester 2.
 * During the Semester 1 view, moyenneS2, moyenneGenerale, and decisionJury
 * are set to '-' by the displaySummary getter (see below).
 *
 * Fields:
 *   moyenneS1           — weighted average for all Semester 1 modules
 *   moyenneS2           — weighted average for all Semester 2 modules
 *   moyenneGenerale     — overall weighted average across both semesters
 *   creditsValides      — total ECTS credits earned (validated modules ≥ 10)
 *   creditsCapitalises  — total ECTS credits capitalised (may differ from validated)
 *   decisionJury        — official jury verdict for the academic year
 *
 * When connected to backend: the backend should compute moyenneS1/S2/Generale
 * server-side and return them as pre-formatted strings (e.g. "11.80").
 * Alternatively the frontend computes them locally via computeWeightedAverage().
 */
export interface TranscriptSummary {
  moyenneS1: string;
  moyenneS2: string;
  moyenneGenerale: string;
  creditsValides: number | string;
  creditsCapitalises: number | string;
  decisionJury: DecisionJury;
}


// ═════════════════════════════════════════════════════════════════════════════
//  COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-releve-notes',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './releve-notes.html',
  styleUrl: './releve-notes.css',
})
export class ReleveNotes implements OnInit {

  // ─── STEP 1: Inject your service here when backend is ready ───────────────
  // constructor(private transcriptService: TranscriptService) {}
  // ─────────────────────────────────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════════════════════════
  //  PREVIEW MODE FLAG
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * previewMode controls whether the component uses static mock data
   * or attempts to load real data from the backend.
   *
   * TRUE  (current) — static preview data is loaded; no API calls are made.
   *                   Use this during frontend development and layout testing.
   *
   * FALSE           — ngOnInit() will call the backend APIs.
   *                   Set this to false once your service is ready.
   *
   * ─── TO DISABLE PREVIEW MODE ─────────────────────────────────────────────
   *   1. Set previewMode = false
   *   2. Uncomment the constructor injection above
   *   3. Implement the ngOnInit() body (see the guide block at the top)
   *   4. Delete the entire "PREVIEW DATA" section at the bottom of this file
   */
  previewMode = true;


  // ═══════════════════════════════════════════════════════════════════════════
  //  COMPONENT STATE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * studentInfo — holds the student's personal and academic identity.
   *
   * Initialised to null. Populated either:
   *   - In preview mode: by loadPreviewData() at the end of this file.
   *   - In live mode:    by the API call in ngOnInit().
   *
   * The HTML template must guard against null:
   *   {{ studentInfo?.nom }}
   */
  studentInfo: StudentInfo | null = null;

  /**
   * modules — the full list of ModuleGrade objects for the student.
   *
   * Populated either from preview data or from the backend.
   * Filtered by semester using the gradesS1 / gradesS2 getters.
   *
   * Empty array means no modules are available yet → the emptyState flag
   * will trigger the "Notes non disponibles" message in the template.
   */
  modules: ModuleGrade[] = [];

  /**
   * backendSummary — the TranscriptSummary received from the backend.
   *
   * When null, averages are computed locally by the frontend using
   * computeWeightedAverage(). This is the fallback for STATE 2 and preview.
   *
   * When provided by the backend (STATE 3), the backend values take priority
   * and local computation is skipped. See displaySummary getter.
   *
   * Source API: GET /student/transcript-summary
   */
  backendSummary: TranscriptSummary | null = null;

  /**
   * juryDecisionS2 — the jury verdict for the academic year.
   *
   * Kept as a separate field so it can be updated independently of the
   * full summary object (e.g. if jury decisions are published separately).
   *
   * Source API: GET /student/transcript-summary → field decisionJury
   *
   * Default value is '-' until the backend provides a real value.
   */
  juryDecisionS2: DecisionJury = '-';

  /**
   * isLoading — true while an API request is in flight.
   *
   * Used to show a loading indicator in the template.
   * Set to false after all data has been received or on error.
   *
   * In preview mode this is always false (data loads synchronously).
   */
  isLoading = false;


  // ═══════════════════════════════════════════════════════════════════════════
  //  SEMESTER NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * currentSemester — controls which semester is currently displayed.
   *
   * Drives three things:
   *   1. The grades table (shows only modules for the active semester).
   *   2. The summary table (hides S2/Generale values when viewing S1).
   *   3. The active state of the navigation buttons in the template.
   *
   * Default: 1 (Semester 1 is shown on first load).
   */
  currentSemester: 1 | 2 = 1;

  /**
   * setSemester — switches the active semester view.
   *
   * Called by the [Semestre 1] / [Semestre 2] navigation buttons.
   * Does not trigger any API calls — the full module list for both semesters
   * is loaded once on init and filtered client-side.
   *
   * @param sem — 1 or 2
   */
  setSemester(sem: 1 | 2): void {
    this.currentSemester = sem;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * ngOnInit — entry point for data loading.
   *
   * In preview mode: calls loadPreviewData() which populates the component
   * with the static mock data defined at the bottom of this file.
   *
   * In live mode: replace the if-block with real service calls:
   *
   *   this.isLoading = true;
   *   forkJoin({
   *     profile : this.transcriptService.getStudentProfile(),
   *     modules : this.transcriptService.getModules(),
   *     summary : this.transcriptService.getTranscriptSummary(),
   *   }).subscribe({
   *     next: ({ profile, modules, summary }) => {
   *       this.studentInfo    = profile;
   *       this.modules        = modules;
   *       this.backendSummary = summary;
   *       this.juryDecisionS2 = summary.decisionJury;
   *       this.isLoading = false;
   *     },
   *     error: (err) => {
   *       console.error('Transcript load failed:', err);
   *       this.isLoading = false;
   *     }
   *   });
   */
  ngOnInit(): void {
    if (this.previewMode) {
      this.loadPreviewData();
    }
    // ── LIVE MODE: replace the block above with API calls (see comment above)
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  DERIVED GETTERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * emptyState — true when no modules are loaded.
   *
   * When true, the template should display:
   *   "Les notes ne sont pas encore disponibles."
   *
   * This covers STATE 1 (preview mode with empty arrays) and the period
   * between backend connection and the first data load completing.
   *
   * Usage in template:
   *   <div *ngIf="emptyState" class="empty-message">
   *     Les notes ne sont pas encore disponibles.
   *   </div>
   *   <table *ngIf="!emptyState"> ... </table>
   */
  get emptyState(): boolean {
    return this.modules.length === 0;
  }

  /**
   * gradesPublished — true when at least one module has a non-null moyenne.
   *
   * Used to distinguish STATE 2 (modules loaded, grades null) from STATE 3
   * (modules loaded, grades published).
   *
   * In STATE 2 the table renders but grade columns show "–".
   * You can use this flag to add a banner:
   *   <div *ngIf="!gradesPublished && !emptyState">
   *     Les résultats seront publiés prochainement.
   *   </div>
   */
  get gradesPublished(): boolean {
    return this.modules.some(m => m.moyenneModule !== null);
  }

  /**
   * gradesS1 / gradesS2 — modules filtered by semester.
   *
   * Both getters work regardless of whether grades are published.
   * If grades are null the table still renders with "–" values.
   */
  get gradesS1(): ModuleGrade[] {
    return this.modules.filter(m => m.semester === 1);
  }

  get gradesS2(): ModuleGrade[] {
    return this.modules.filter(m => m.semester === 2);
  }

  /**
   * currentGrades — the module list for the active semester.
   *
   * This is what the *ngFor in the grades table iterates.
   * It switches automatically when setSemester() is called.
   */
  get currentGrades(): ModuleGrade[] {
    return this.currentSemester === 1 ? this.gradesS1 : this.gradesS2;
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  AVERAGE COMPUTATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * computeWeightedAverage — calculates the weighted mean of a module list.
   *
   * Only includes modules where moyenneModule is not null.
   * Returns '–' when no valid grades exist.
   *
   * Formula: Σ(moyenne × coefficient) / Σ(coefficient)
   *
   * When the backend provides pre-computed averages via backendSummary,
   * these getters are bypassed by displaySummary (backend values take priority).
   */
  private computeWeightedAverage(list: ModuleGrade[]): string {
    const valid = list.filter(m => m.moyenneModule !== null);
    if (valid.length === 0) return '–';
    const totalWeighted = valid.reduce((s, m) => s + m.moyenneModule! * m.coefficient, 0);
    const totalCoeff    = valid.reduce((s, m) => s + m.coefficient, 0);
    return (totalWeighted / totalCoeff).toFixed(2);
  }

  get moyenS1(): string        { return this.computeWeightedAverage(this.gradesS1); }
  get moyenS2(): string        { return this.computeWeightedAverage(this.gradesS2); }
  get moyenneGenerale(): string { return this.computeWeightedAverage(this.modules); }


  // ═══════════════════════════════════════════════════════════════════════════
  //  CREDIT TOTALS
  // ═══════════════════════════════════════════════════════════════════════════

  get totalCreditsS1(): number { return this.gradesS1.reduce((s, m) => s + m.credit, 0); }
  get totalCreditsS2(): number { return this.gradesS2.reduce((s, m) => s + m.credit, 0); }
  get totalCredits():   number { return this.modules.reduce((s, m)  => s + m.credit, 0); }


  // ═══════════════════════════════════════════════════════════════════════════
  //  SEMESTER-AWARE SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * displaySummary — builds the TranscriptSummary object shown in the summary table.
   *
   * Priority logic:
   *   If backendSummary is not null → use backend-provided values directly.
   *   Otherwise → compute averages locally from the modules array.
   *
   * Semester 1 view:
   *   moyenneS2 and moyenneGenerale are always '–' (not yet available).
   *   decisionJury is always '-'.
   *   Credits reflect Semester 1 totals only.
   *
   * Semester 2 view:
   *   All averages are populated (computed or from backend).
   *   decisionJury comes from juryDecisionS2 (set from backend).
   *   Credits reflect the full-year totals.
   *
   * Template usage:
   *   {{ displaySummary.moyenneS1 }}
   *   {{ displaySummary.decisionJury }}
   */
  get displaySummary(): TranscriptSummary {

    // ── Priority: use backend-provided summary if available ──────────────────
    if (this.backendSummary !== null && this.currentSemester === 2) {
      return this.backendSummary;
    }

    // ── Semester 1 view: partial summary ─────────────────────────────────────
    if (this.currentSemester === 1) {
      return {
        moyenneS1:          this.moyenS1,
        moyenneS2:          '–',
        moyenneGenerale:    '–',
        creditsValides:     this.totalCreditsS1,
        creditsCapitalises: this.totalCreditsS1,
        decisionJury:       '-',
      };
    }

    // ── Semester 2 view: full summary computed locally ────────────────────────
    return {
      moyenneS1:          this.moyenS1,
      moyenneS2:          this.moyenS2,
      moyenneGenerale:    this.moyenneGenerale,
      creditsValides:     this.totalCredits,
      creditsCapitalises: this.totalCredits,   // TODO: replace with backend value (may differ)
      decisionJury:       this.juryDecisionS2,
    };
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  PRESENTATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * getMoyenneClass — returns a CSS class based on the grade value.
   *
   * Used in the template: [ngClass]="getMoyenneClass(grade.moyenneModule)"
   *
   * Classes are defined in profil.css:
   *   .grade-excellent  ≥ 16  (dark green)
   *   .grade-good       ≥ 12  (dark blue)
   *   .grade-pass       ≥ 10  (amber)
   *   .grade-fail       < 10  (dark red)
   *   .grade-none       null  (grey — not yet published)
   */
  getMoyenneClass(moyenne: number | null): string {
    if (moyenne === null) return 'grade-none';
    if (moyenne >= 16)   return 'grade-excellent';
    if (moyenne >= 12)   return 'grade-good';
    if (moyenne >= 10)   return 'grade-pass';
    return 'grade-fail';
  }

  /**
   * getDecisionClass — returns a CSS class for the jury decision cell.
   *
   * Used in the template: [ngClass]="getDecisionClass(displaySummary.decisionJury)"
   *
   * Classes are defined in profil.css:
   *   .decision-admis    → green
   *   .decision-controle → amber
   *   .decision-refuse   → red
   *   .decision-pending  → grey (default / '-')
   */
  getDecisionClass(decision: DecisionJury): string {
    switch (decision) {
      case 'Admis':    return 'decision-admis';
      case 'Contrôle': return 'decision-controle';
      case 'Refusé':   return 'decision-refuse';
      default:         return 'decision-pending';
    }
  }

  /**
   * getMention — returns the honorary mention label for a given average string.
   *
   * Used in the average bar below each semester table (if present).
   */
  getMention(avg: string): string {
    const n = parseFloat(avg);
    if (isNaN(n)) return '';
    if (n >= 16) return 'Très Bien';
    if (n >= 14) return 'Bien';
    if (n >= 12) return 'Assez Bien';
    if (n >= 10) return 'Passable';
    return 'Insuffisant';
  }


  // ═════════════════════════════════════════════════════════════════════════
  /**
   * PREVIEW DATA
   *
   * This placeholder data is used only to display the layout
   * of the transcript before backend integration.
   *
   * All real student data will be provided later by the backend APIs:
   *   GET /student/profile             → replaces PREVIEW_STUDENT
   *   GET /student/modules             → replaces PREVIEW_MODULES
   *   GET /student/transcript-summary  → populates backendSummary
   *
   * When backend integration begins, this entire section can be removed.
   * Set previewMode = false and implement ngOnInit() with real service calls.
   */

  private loadPreviewData(): void {
    this.studentInfo = this.PREVIEW_STUDENT;
    this.modules     = this.PREVIEW_MODULES;
    // backendSummary is intentionally left null so averages are computed locally.
    this.juryDecisionS2 = '-';
  }

  // ── PREVIEW: Student profile ───────────────────────────────────────────────
  private readonly PREVIEW_STUDENT: StudentInfo = {
    nom:            '----',
    prenom:         '----',
    dateNaissance:  '----',
    lieuNaissance:  '----',
    cin:            '----',
    numInscription: '----',
    situation:      '----',
    diplome:        '----',
    specialite:     '----',
    niveau:         '----',
    institution:    '----',
  };

  // ── PREVIEW: Module grades ─────────────────────────────────────────────────
  private readonly PREVIEW_MODULES: ModuleGrade[] = [

    // ── Semester 1 ─────────────────────────────────────────────────────────
    { codeModule: 'B26', moduleName: '----------', semester: 1, coefficient: 1.50, credit: 3.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B27', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B28', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B29', moduleName: '----------', semester: 1, coefficient: 1.50, credit: 3.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B30', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B31', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B32', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B33', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B34', moduleName: '----------', semester: 1, coefficient: 2.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B35', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 4.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B36', moduleName: '----------', semester: 1, coefficient: 2.00, credit: 4.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B39', moduleName: '----------', semester: 1, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },

    // ── Semester 2 ─────────────────────────────────────────────────────────
    { codeModule: 'B40', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B41', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B42', moduleName: '----------', semester: 2, coefficient: 2.00, credit: 4.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B43', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B44', moduleName: '----------', semester: 2, coefficient: 1.50, credit: 3.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B45', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B46', moduleName: '----------', semester: 2, coefficient: 1.50, credit: 3.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B47', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B48', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B49', moduleName: '----------', semester: 2, coefficient: 1.00, credit: 2.00, contrContinu: null, examen: null, moyenneModule: null },
    { codeModule: 'B50', moduleName: '----------', semester: 2, coefficient: 2.00, credit: 4.00, contrContinu: null, examen: null, moyenneModule: null },
  ];
}