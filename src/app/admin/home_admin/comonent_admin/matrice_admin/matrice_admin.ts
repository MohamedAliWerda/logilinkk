import { ChangeDetectionStrategy, Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Interfaces pour typer les données
 */
interface Metier {
  id: string;
  code: string;
  nameFr: string;
}

interface Matiere {
  id: string;
  filiere: string;
  semestre: string;
  nameFr: string;
  scores: number[];
}

@Component({
  selector: 'app-matrice-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './matrice_admin.html',
  styleUrl: './matrice_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatriceAdmin {
  // --- États (Signals) ---
  showAll = signal(false);
  selectedNiveau = signal<string>('Toutes');
  selectedFiliere = signal<string>('Toutes');
  searchQuery = signal<string>('');

  readonly INITIAL_MATIERES = 10;

  // --- Données Statiques ---
  readonly metiers: Metier[] = [
    { id: 'm1',  code: 'M01', nameFr: 'Conducteur Routier (PL/SPL)' },
    { id: 'm2',  code: 'M02', nameFr: 'Conducteur Livreur (VUL)' },
    { id: 'm3',  code: 'M03', nameFr: 'Ambulancier' },
    { id: 'm4',  code: 'M04', nameFr: 'Convoyeur de fonds / Dabiste' },
    { id: 'm5',  code: 'M05', nameFr: 'Batelier - Marinier' },
    { id: 'm6',  code: 'M06', nameFr: 'Agent de Quai / Manutentionnaire' },
    { id: 'm7',  code: 'M07', nameFr: 'Cariste' },
    { id: 'm8',  code: 'M08', nameFr: 'Préparateur de commandes' },
    { id: 'm9',  code: 'M09', nameFr: 'Déménageur' },
    { id: 'm10', code: 'M10', nameFr: 'Mécanicien Poids Lourds' },
    { id: 'm11', code: 'M11', nameFr: 'Responsable de Parc' },
    { id: 'm12', code: 'M12', nameFr: "Responsable d'Exploitation" },
    { id: 'm13', code: 'M13', nameFr: 'Affréteur' },
    { id: 'm14', code: 'M14', nameFr: 'Demand Planner (Prévisionniste)' },
    { id: 'm15', code: 'M15', nameFr: 'Gestionnaire de Stocks' },
    { id: 'm16', code: 'M16', nameFr: 'Responsable Douane' },
    { id: 'm17', code: 'M17', nameFr: 'Consultant Logistique / Ingénieur Méthodes' },
    { id: 'm18', code: 'M18', nameFr: 'Responsable QSE (Qualité Sécurité)' },
    { id: 'm19', code: 'M19', nameFr: 'Commercial Transport' },
    { id: 'm20', code: 'M20', nameFr: 'Agent Maritime (Consignataire)' },
    { id: 'm21', code: 'M21', nameFr: 'Supply Chain Manager' },
    { id: 'm22', code: 'M22', nameFr: "Responsable d'Entrepôt" },
    { id: 'm23', code: 'M23', nameFr: "Responsable d'Agence Transport" },
    { id: 'm24', code: 'M24', nameFr: 'Logisticien Humanitaire' },
  ];

  readonly allMatieres: Matiere[] = [
   // ── Licence Sciences Transport ───────────────────────────────────
   { id: 'd1', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Math 1', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.2, 0.6, 0.4, 0.2, 0.6, 0.2, 0.2, 0.2, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd2', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Probabilité et Statistique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.6] },
    { id: 'd3', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: "Economie d'entreprise", scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.6, 0.6, 0.4, 0.4, 0.4, 0.6, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd4', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Comptabilité Analytique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.8, 0.4, 0.4, 0.4, 0.2, 0.6, 0.2, 0.4, 0.4, 0.8, 0.4, 0.8, 0.2] },
    { id: 'd5', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Conception des SI', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd6', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Algorithmique et Programmation', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0.2, 0.2, 0.6, 0.2, 0, 0.2, 0.4, 0.2, 0.2, 0.2] },
    { id: 'd7', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Initiation à la logistique', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.2, 0.2, 0.4, 0.6, 0.6, 0.6, 0.8, 0.4, 0.8, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'd8', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Modes et systèmes de transport', scores: [0.6, 0.4, 0.4, 0.4, 0.6, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.8, 0.4, 0.6, 0.8, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd9', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'Anglais 1', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd10', filiere: 'Licence en Gestion de Transport', semestre: 'S1', nameFr: 'C2I 1', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd11', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Math 2', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.4, 0.2, 0.8, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'd12', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Statistique inférentielle', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.6] },
    { id: 'd13', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Instrumentation et Métrologie', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0, 0.4, 0.6, 0.2, 0.2, 0.4, 0.4, 0.2] },
    { id: 'd14', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Conception et Dessin Industriel', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0, 0, 0.4, 0.4, 0.2, 0.2] },
    { id: 'd15', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Bases de Données', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd16', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Programmation Linéaire', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.4, 0.2, 0.8, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'd17', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Supply Chain Management', scores: [0, 0, 0.2, 0, 0, 0.4, 0.4, 0.6, 0.2, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'd18', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Infrastructures de transport', scores: [0.6, 0.4, 0.2, 0.2, 0.8, 0.4, 0.2, 0.2, 0.4, 0.2, 0.6, 0.8, 0.6, 0.4, 0.4, 0.4, 0.8, 0.4, 0.6, 0.8, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd19', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'C2I 2', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd20', filiere: 'Licence en Gestion de Transport', semestre: 'S2', nameFr: 'Anglais 2', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd21', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Transport routier', scores: [1, 1, 0.4, 0.6, 0.4, 0.4, 0.2, 0.4, 0.6, 0.6, 0.8, 1, 0.8, 0.4, 0.4, 0.4, 0.8, 0.6, 0.8, 0.4, 0.8, 0.4, 1, 0.6] },
    { id: 'd22', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Transport ferroviaire', scores: [0.2, 0.2, 0, 0, 0.6, 0.2, 0.2, 0.2, 0, 0, 0.4, 0.8, 1, 0.4, 0.4, 0.4, 0.8, 0.4, 0.6, 0.6, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd23', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Transport maritime', scores: [0.2, 0.2, 0, 0, 0.8, 0.4, 0.2, 0.2, 0, 0, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.8, 0.4, 0.8, 1, 0.8, 0.4, 0.6, 0.6] },
    { id: 'd24', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Transport Aérien', scores: [0, 0, 0, 0, 0, 0.2, 0, 0.2, 0, 0, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.8, 0.4, 0.8, 0.8, 0.8, 0.4, 0.6, 0.6] },
    { id: 'd25', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Commerce et accords internationaux', scores: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.2, 0.4, 1, 0.4, 0.4, 0.8, 0.6, 0.2, 1, 0.8, 0.6, 0.2, 0.6, 0.6] },
    { id: 'd26', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Techniques financières internationales', scores: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.2, 0.4, 1, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 1, 0.6, 0.2, 0.6, 0.2] },
    { id: 'd27', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Microéconomie', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4] },
    { id: 'd28', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Macroéconomie', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4] },
    { id: 'd29', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Anglais 3', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd30', filiere: 'Licence en Gestion de Transport', semestre: 'S3', nameFr: 'Techniques de communication 1', scores: [0.4, 0.4, 0.4, 0.4, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    { id: 'd31', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Droit des Transports', scores: [0.8, 0.8, 0.4, 0.6, 0.8, 0.4, 0.2, 0.2, 0.6, 0.2, 0.6, 0.8, 1, 0.4, 0.4, 0.8, 0.8, 0.6, 0.8, 0.8, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd32', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Techniques douanières et Transit', scores: [0.6, 0.2, 0, 0, 0.6, 0.2, 0, 0.2, 0, 0, 0.2, 0.6, 1, 0.4, 0.4, 1, 0.6, 0.2, 0.8, 1, 0.6, 0.2, 0.6, 0.6] },
    { id: 'd33', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Gestion de Projet', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0, 0.4, 0.8, 0.6, 0.4, 0.4, 0.4, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6, 0.8, 0.6] },
    { id: 'd34', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Analyse économique des projets', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.4, 0.2, 0.8, 0.4, 0.6, 0.4, 0.8, 0.6, 0.8, 0.4] },
    { id: 'd35', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Géographie de Transport', scores: [0.6, 0.4, 0.2, 0.2, 0.8, 0.2, 0, 0.2, 0.2, 0.2, 0.4, 0.8, 0.8, 0.4, 0.4, 0.8, 0.2, 0.6, 0.6, 0.8, 0.4, 0.6, 0.8, 0.4] },
    { id: 'd36', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Economie de Transport', scores: [0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0, 0.2, 0.2, 0, 0.6, 0.8, 0.8, 0.6, 0.4, 0.4, 0.8, 0.4, 1, 0.6, 0.8, 0.4, 1, 0.4] },
    { id: 'd37', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Analyse technico-économique des systèmes de transport', scores: [0.2, 0.2, 0, 0, 0.4, 0.2, 0.2, 0.2, 0, 0.2, 0.4, 0.8, 0.8, 0.6, 0.4, 0.4, 0.8, 0.4, 0.6, 0.6, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd38', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Transport et Développement Durable', scores: [0.6, 0.4, 0.2, 0, 0.4, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.6, 0.4, 0.2, 0.2, 0.4, 0.6, 0.8, 0.4, 0.4, 0.6, 0.4, 0.4, 0.8] },
    { id: 'd39', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Entrepreneuriat 1', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.2, 0.2, 0.2, 0.4, 0.2, 0.8, 0.2, 0.4, 0.2, 0.4, 0.2] },
    { id: 'd40', filiere: 'Licence en Gestion de Transport', semestre: 'S4', nameFr: 'Techniques de communication 2', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    { id: 'd41', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Méthodes opérationnelles d\'aide à la décision', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.8, 0.6, 1, 0.6, 0.4, 1, 0.6, 0.6, 0.4, 1, 0.6, 0.8, 0.6] },
    { id: 'd42', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Enquête et Analyse de données', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 0.8, 0.6, 0.6, 0.4, 0.8, 0.4, 0.6, 0.6] },
    { id: 'd43', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Gestion de plateforme logistique', scores: [0.4, 0.2, 0, 0, 0.4, 0.8, 0.8, 0.8, 0.6, 0.2, 0.6, 0.8, 0.6, 0.6, 0.8, 0.4, 0.8, 0.8, 0.8, 0.4, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd44', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Gestion portuaire', scores: [0, 0, 0, 0, 1, 0.6, 0.4, 0.4, 0, 0, 0.4, 0.8, 0.6, 0.4, 0.4, 0.6, 0.8, 0.4, 0.6, 1, 0.8, 1, 0.6, 0.4] },
    { id: 'd45', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Optimisation des Transports', scores: [0.6, 0.6, 0, 0, 0.4, 0.2, 0.2, 0.4, 0, 0, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 1, 0.4, 0.6, 0.6, 1, 0.6, 0.8, 0.6] },
    { id: 'd46', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Logistique de distribution', scores: [0.4, 0.8, 0, 0, 0.2, 0.6, 0.4, 0.8, 0.2, 0, 0.4, 0.8, 0.8, 0.8, 0.8, 0.4, 0.8, 0.4, 0.4, 0.4, 0.8, 0.8, 0.6, 0.6] },
    { id: 'd47', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Modélisation et simulation des S. Transport', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.4, 0.4, 1, 0.4, 0.4, 0.4, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd48', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Transport des marchandises dangereuses / Sûreté et sécurité', scores: [1, 0.6, 0.4, 0.4, 0.8, 0.6, 0.4, 0.6, 0.4, 0.8, 0.6, 0.8, 0.8, 0.4, 0.6, 0.6, 0.8, 1, 0.8, 0.6, 0.8, 0.6, 0.8, 0.8] },
    { id: 'd49', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Entrepreneuriat 2', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.2, 0.2, 0.2, 0.4, 0.2, 0.6, 0.2, 0.4, 0.2, 0.6, 0.2] },
    { id: 'd50', filiere: 'Licence en Gestion de Transport', semestre: 'S5', nameFr: 'Techniques de communication 3', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    // ── Licence Génie Logistique ─────────────────────────────────────
    { id: 'd1', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Math 1', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.2, 0.6, 0.4, 0.2, 0.6, 0.2, 0.2, 0.2, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd2', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Probabilité et Statistique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.6] },
    { id: 'd3', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: "Economie d'entreprise", scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.6, 0.6, 0.4, 0.4, 0.4, 0.6, 0.4, 0.6, 0.4, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd4', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Comptabilité Analytique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.8, 0.4, 0.4, 0.4, 0.2, 0.6, 0.2, 0.4, 0.4, 0.8, 0.4, 0.8, 0.2] },
    { id: 'd5', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Conception des SI', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd6', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Algorithmique et Programmation', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0.2, 0.2, 0.6, 0.2, 0, 0.2, 0.4, 0.2, 0.2, 0.2] },
    { id: 'd7', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Initiation à la logistique', scores: [0.2, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.2, 0, 0.4, 0.6, 0.6, 0.6, 0.8, 0.4, 0.8, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'd8', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Modes et systèmes de transport', scores: [0.6, 0.4, 0.2, 0.2, 0.6, 0.4, 0.2, 0.4, 0.2, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.8, 0.4, 0.6, 0.8, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd9', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'Anglais 1', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd10', filiere: 'Licence_Génie_Logistique', semestre: 'S1', nameFr: 'C2I 1', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd11', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Math 2', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.4, 0.2, 0.8, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'd12', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Statistique inférentielle', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.6] },
    { id: 'd13', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Instrumentation et Métrologie', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0, 0.4, 0.6, 0.2, 0.2, 0.4, 0.4, 0.2] },
    { id: 'd14', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Conception et Dessin Industriel', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0.4, 0.2, 0.2, 0.2, 0, 0.4, 0.4, 0, 0, 0.4, 0.4, 0.2, 0.2] },
    { id: 'd15', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Bases de Données', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd16', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Programmation Linéaire', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.4, 0.2, 0.8, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'd17', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Supply Chain Management', scores: [0, 0, 0.2, 0, 0, 0.4, 0.4, 0.6, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'd18', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Infrastructures de transport', scores: [0.4, 0.4, 0.2, 0.2, 0.6, 0.4, 0.2, 0.2, 0.2, 0.2, 0.6, 0.8, 0.6, 0.4, 0.4, 0.4, 0.8, 0.4, 0.6, 0.8, 0.8, 0.4, 0.8, 0.6] },
    { id: 'd19', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'Anglais 2', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd20', filiere: 'Licence_Génie_Logistique', semestre: 'S2', nameFr: 'C2I 2', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.4] },
    { id: 'd21', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Gestion de Projet', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0, 0.4, 0.8, 0.6, 0.4, 0.4, 0.4, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6, 0.8, 0.6] },
    { id: 'd22', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Gestion de la maintenance', scores: [0.4, 0.4, 0, 0, 0.4, 0.4, 0.4, 0.2, 0, 1, 0.8, 0.6, 0.4, 0.2, 0.4, 0.2, 0.8, 0.8, 0.2, 0.2, 0.6, 0.4, 0.4, 0.2] },
    { id: 'd23', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Gestion de la production', scores: [0, 0, 0, 0, 0, 0.4, 0.8, 0.8, 0, 0.2, 0.4, 0.6, 0.4, 0.8, 0.8, 0.2, 0.8, 0.6, 0.2, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd24', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Gestion de la qualité', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.2, 0.6, 0.6, 0.6, 0.4, 0.4, 0.6, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.6, 0.6, 0.6] },
    { id: 'd25', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Modélisation des systèmes logistiques', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.6, 0.6, 0.6] },
    { id: 'd26', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Lean Supply Chain Management', scores: [0, 0, 0, 0, 0, 0.6, 0.6, 0.8, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.8, 0.4, 0.4, 1, 0.8, 0.6, 0.6] },
    { id: 'd27', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Analyse technico-économique des systèmes de transport', scores: [0.2, 0.2, 0, 0, 0.4, 0.2, 0.2, 0.2, 0, 0.2, 0.4, 0.8, 0.8, 0.6, 0.4, 0.4, 0.8, 0.4, 0.6, 0.6, 0.8, 0.4, 0.6, 0.4] },
    { id: 'd28', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Droit des transports', scores: [0.8, 0.6, 0.4, 0.6, 0.6, 0.4, 0.2, 0.2, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.8, 0.8, 0.6, 0.8, 0.8, 0.8, 0.4, 0.8, 0.8] },
    { id: 'd29', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Anglais 3', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'd30', filiere: 'Licence_Génie_Logistique', semestre: 'S3', nameFr: 'Techniques de communication 1', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    { id: 'd31', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Méthodes opérationnelles d\'aide à la décision', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.8, 0.6, 1, 0.6, 0.4, 1, 0.6, 0.6, 0.4, 1, 0.6, 0.8, 0.6] },
    { id: 'd32', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Enquête et Analyse de données', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 0.8, 0.6, 0.6, 0.4, 0.8, 0.4, 0.6, 0.6] },
    { id: 'd33', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Ordonnancement', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0, 0.4, 0.6, 0.4, 0.8, 0.6, 0.2, 0.8, 0.4, 0.2, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd34', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Gestion des stocks', scores: [0, 0.2, 0, 0, 0, 0.4, 0.6, 1, 0, 0, 0.4, 0.6, 0.6, 1, 1, 0.4, 0.8, 0.6, 0.4, 0.4, 1, 1, 0.6, 0.8] },
    { id: 'd35', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Logistique internationale', scores: [0.2, 0, 0, 0, 0.4, 0.4, 0.2, 0.4, 0, 0, 0.4, 0.6, 1, 0.6, 0.6, 1, 0.8, 0.4, 0.6, 1, 0.8, 0.4, 0.6, 0.8] },
    { id: 'd36', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Techniques logistiques d\'import et d\'export', scores: [0.2, 0, 0, 0, 0.4, 0.4, 0.2, 0.4, 0, 0, 0.4, 0.6, 1, 0.6, 0.6, 1, 0.8, 0.4, 0.6, 1, 0.8, 0.4, 0.6, 0.8] },
    { id: 'd37', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Gestion de plateforme logistique', scores: [0.2, 0.2, 0, 0, 0.4, 0.8, 0.8, 0.8, 0.4, 0.2, 0.6, 0.8, 0.6, 0.6, 0.8, 0.4, 0.8, 0.8, 0.4, 0.4, 0.8, 1, 0.6, 0.8] },
    { id: 'd38', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Gestion des risques industriels', scores: [0.6, 0.4, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 0.2, 0.8, 0.6, 0.6, 0.4, 0.2, 0.2, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.6, 0.6, 0.2] },
    { id: 'd39', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Entrepreneuriat 1', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.2, 0.2, 0.2, 0.4, 0.2, 0.6, 0.2, 0.4, 0.2, 0.6, 0.2] },
    { id: 'd40', filiere: 'Licence_Génie_Logistique', semestre: 'S4', nameFr: 'Techniques de communication 2', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    { id: 'd41', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Progiciel de Gestion Intégrée (PGI/ERP)', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.8, 0.6, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'd42', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Programmation Mobile', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.2, 0.2, 0.4, 0.4, 0.2, 0.6, 0.2, 0.2, 0.2, 0.4, 0.4, 0.2, 0.2] },
    { id: 'd43', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Optimisation des Systèmes Logistiques', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.6, 0.6, 0.4] },
    { id: 'd44', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Simulation des Systèmes Logistiques', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.6, 0.6, 0.4] },
    { id: 'd45', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Emballage et manutention', scores: [0.2, 0.2, 0, 0, 0.2, 0.8, 1, 1, 0.8, 0.2, 0.4, 0.6, 0.4, 0.4, 0.8, 0.2, 0.6, 0.8, 0.2, 0.2, 0.6, 0.8, 0.4, 0.6] },
    { id: 'd46', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Logistique de Distribution', scores: [0.4, 0.6, 0, 0, 0.2, 0.6, 0.4, 0.8, 0.2, 0, 0.4, 0.8, 0.6, 0.8, 0.8, 0.4, 0.8, 0.4, 0.4, 0.4, 0.8, 0.8, 0.6, 0.6] },
    { id: 'd47', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Techniques de traçabilité', scores: [0.2, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.8, 0, 0, 0.4, 0.6, 0.6, 0.6, 1, 0.4, 0.8, 0.6, 0.4, 0.4, 0.8, 1, 0.6, 0.6] },
    { id: 'd48', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'IoT (Internet of Things)', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0.2, 0.4, 0.4, 0.4, 0.6, 0.6, 0.2, 0.8, 0.4, 0.2, 0.4, 1, 0.8, 0.4, 0.4] },
    { id: 'd49', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Entrepreneuriat 2', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.2, 0.2, 0.2, 0.4, 0.2, 0.6, 0.2, 0.4, 0.2, 0.6, 0.2] },
    { id: 'd50', filiere: 'Licence_Génie_Logistique', semestre: 'S5', nameFr: 'Techniques de communication 3', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    // ── Master Recherche STL ─────────────────────────────────────────
    { id: 'm1', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Economie de l\'information et de l\'incertain', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.6, 0.4, 0.4, 0.8, 0.2, 0.4, 0.4, 0.8, 0.2, 0.4, 0.4] },
    { id: 'm2', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Techniques de simulation', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 0.4, 0.2, 1, 0.2, 0.4, 0.4, 0.8, 0.4, 0.4, 0.4] },
    { id: 'm3', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Économie des transports', scores: [0.2, 0.2, 0, 0, 0.4, 0.2, 0, 0.2, 0, 0, 0.4, 1, 0.8, 0.6, 0.4, 0.4, 0.8, 0.4, 1, 0.6, 0.8, 0.4, 1, 0.4] },
    { id: 'm4', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Transport multimodal et mobilité durable', scores: [0.6, 0.4, 0.2, 0, 1, 0.4, 0.2, 0.4, 0.2, 0.2, 0.6, 0.8, 1, 0.4, 0.4, 0.6, 0.8, 0.6, 0.8, 1, 0.8, 0.4, 0.8, 0.8] },
    { id: 'm5', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Méthodes opérationnelles d\'aide à la décision', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.8, 0.6, 0.8, 0.6, 0.4, 1, 0.6, 0.6, 0.4, 1, 0.6, 0.8, 0.6] },
    { id: 'm6', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Supply Chain Management', scores: [0, 0, 0, 0, 0, 0.4, 0.4, 0.6, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'm7', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Econométrie avancée des modèles linéaires', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.8, 0.2, 0.2, 0.8, 0.2, 0.2, 0.2, 0.6, 0.2, 0.2, 0.4] },
    { id: 'm8', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Anglais 1', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'm9', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Conception des Chaînes logistiques', scores: [0, 0, 0, 0, 0, 0.4, 0.4, 0.6, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'm10', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Analyse et conception des systèmes d\'information', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'm11', filiere: 'Master_Recherche_STL', semestre: 'S1', nameFr: 'Modélisation des Systèmes Logistiques', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.6, 0.6, 0.6] },
    { id: 'm12', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Econométrie des séries temporelles', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.8, 0.2, 0.2, 0.8, 0.2, 0.2, 0.2, 0.6, 0.2, 0.2, 0.4, 0.4] },
    { id: 'm13', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Théorie des jeux', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.4, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4, 0.6, 0.2, 0.4, 0.4] },
    { id: 'm14', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Gestion des risques des réseaux de transports', scores: [0.6, 0.4, 0.2, 0.2, 0.8, 0.4, 0.2, 0.4, 0.2, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.8, 1, 0.6, 0.8, 0.8, 0.4, 0.8, 0.8] },
    { id: 'm15', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Gestion des Infrastructures de Transport', scores: [0.2, 0.2, 0, 0, 1, 0.4, 0.2, 0.2, 0, 0.2, 0.6, 1, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.6, 0.8, 0.8, 0.4, 0.8, 0.4] },
    { id: 'm16', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Economie maritime et portuaire', scores: [0, 0, 0, 0, 1, 0.4, 0.2, 0.2, 0, 0, 0.4, 0.8, 0.8, 0.4, 0.4, 0.6, 0.8, 0.4, 0.6, 1, 0.8, 0.4, 0.6, 0.4] },
    { id: 'm17', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Ordonnancement et Planification Logistique', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.8, 0, 0, 0.4, 0.8, 0.6, 1, 1, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.6, 0.6, 0.6] },
    { id: 'm18', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Logistique de Production et de distribution', scores: [0, 0.2, 0, 0, 0.2, 0.6, 0.6, 0.8, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 0.8, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.6] },
    { id: 'm19', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Analyse des données et data mining', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.4, 0.8, 0.4, 0.4, 0.4, 0.8, 0.4, 0.4, 0.4] },
    { id: 'm20', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Anglais 2', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'm21', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Aide à la décision logistique', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.8, 0.6, 0.8, 0.6, 0.4, 1, 0.6, 0.6, 0.4, 1, 0.6, 0.8, 0.6] },
    { id: 'm22', filiere: 'Master_Recherche_STL', semestre: 'S2', nameFr: 'Économie Internationale Approfondie', scores: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.6, 0.6, 0.2, 0.6, 0.4] },
    { id: 'm23', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Econométrie des données de panel', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.8, 0.2, 0.2, 0.8, 0.2, 0.2, 0.2, 0.6, 0.2, 0.2, 0.4, 0.4] },
    { id: 'm24', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Modélisation économique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0.8, 0.4, 0.4, 0.8, 0.2, 0.4, 0.4, 0.8, 0.2, 0.4, 0.4] },
    { id: 'm25', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Géographie des transports', scores: [0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0, 0.2, 0.2, 0.2, 0.4, 0.8, 0.8, 0.4, 0.4, 0.4, 0.8, 0.2, 0.6, 0.6, 0.8, 0.4, 0.6, 0.6] },
    { id: 'm26', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Planification des Transports et Logistique Urbaine', scores: [0.6, 0.6, 0.2, 0, 0.4, 0.4, 0.2, 0.4, 0.2, 0.2, 0.6, 0.8, 0.8, 0.6, 0.4, 0.4, 0.8, 0.6, 0.8, 0.6, 0.8, 0.4, 0.8, 1] },
    { id: 'm27', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Intelligence économique', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.6, 0.6, 0.4, 0.4, 0.6, 0.6, 0.2, 0.8, 0.4, 0.6, 0.2, 0.6, 0.4] },
    { id: 'm28', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Economie Industrielle Appliquée au Transport', scores: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.4, 0.6, 0.8, 0.6, 0.4, 0.6, 0.8, 0.4, 0.8, 0.6, 0.8, 0.4, 0.8, 0.4] },
    { id: 'm29', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Méthodologie de la recherche', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0.2, 0.2, 0.4, 0.2, 0.2, 0.2, 0.4, 0.2, 0.2, 0.4] },
    { id: 'm30', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'English for scientific research', scores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.2, 0.4, 0.6] },
    { id: 'm31', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Optimisation des réseaux des transports', scores: [0.2, 0.2, 0, 0, 0.4, 0.2, 0.2, 0.4, 0, 0, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 1, 0.4, 0.6, 0.6, 1, 0.6, 0.8, 0.6] },
    { id: 'm32', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Optimisation Combinatoire', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.6, 0.8, 0.4, 0.2, 1, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'm33', filiere: 'Master_Recherche_STL', semestre: 'S3', nameFr: 'Intelligence artificielle et heuristique', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.6, 0.8, 0.4, 0.2, 1, 0.2, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },   
    // ── Master Pro Génie Industriel et Logistique ────────────────────
  { id: 'mp1', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Supply Chain Management', scores: [0, 0, 0, 0, 0, 0.4, 0.4, 0.6, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.8, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.8, 0.6, 0.8] },
    { id: 'mp2', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Management des Systèmes Industriels', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.2, 0.8, 0.8, 0.2, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp3', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Stratégie de l\'amélioration continue des systèmes qualité', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0.2, 0.4, 0.6, 0.4, 0.4, 0.4, 0.2, 0.8, 1, 0.4, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp4', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Mise en place d\'un système SMI', scores: [0.2, 0.2, 0.2, 0, 0.2, 0.4, 0.4, 0.4, 0.2, 0.4, 0.6, 0.6, 0.4, 0.4, 0.6, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.6, 0.6, 0.6] },
    { id: 'mp5', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Recherche opérationnelle Appliquée à SI et Logistique', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.6, 0.6, 0.6] },
    { id: 'mp6', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Statistiques Appliquées aux S.I', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.2, 0.4, 0.4, 0.8, 0.6, 0.4, 0.8, 0.6, 0.4, 0.4, 0.8, 0.4, 0.4, 0.4] },
    { id: 'mp7', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Planification Urbaine des Transports', scores: [0.6, 0.8, 0.2, 0, 0.4, 0.4, 0.2, 0.4, 0.2, 0.2, 0.6, 0.8, 0.8, 0.6, 0.4, 0.4, 0.8, 0.6, 0.8, 0.6, 0.8, 0.4, 0.8, 1] },
    { id: 'mp8', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Commerce et échanges Internationaux', scores: [0, 0, 0, 0, 0.2, 0, 0, 0, 0, 0, 0.2, 0.4, 0.8, 0.4, 0.4, 0.8, 0.6, 0.2, 0.8, 0.6, 0.6, 0.2, 0.6, 0.4] },
    { id: 'mp9', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Leadership et management des RH', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0, 0.8, 1, 0.6, 0.4, 0.4, 0.4, 0.6, 0.6, 0.6, 0.6, 0.4, 0.8, 0.6, 1, 0.6, 0.8] },
    { id: 'mp10', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Anglais pour la Logistique', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.6, 0.4, 0.4, 0.6, 0.6, 0.6, 0.4, 0.8, 0.6, 0.4, 0.6, 0.8] },
    { id: 'mp11', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S1', nameFr: 'Atelier de communication', scores: [0.4, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.4, 0.4, 0.2, 0.6, 0.8, 0.8, 0.4, 0.4, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.4, 0.8, 0.6] },
    { id: 'mp12', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'SI et PGI (ERP)', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.6, 0.4, 0.6, 0.6, 0.4, 0.8, 0.6, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp13', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Développement Application Logistique', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.2, 0.4, 0.4, 0.6, 0.6, 0.4, 0.8, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp14', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Méthodes et outils de la maintenance Industrielle', scores: [0.2, 0.2, 0, 0, 0.4, 0.4, 0.4, 0.2, 0, 0.8, 0.8, 0.6, 0.6, 0.4, 0.2, 0.4, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4, 0.2, 0.2] },
    { id: 'mp15', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Sûreté de fonctionnement et gestion des risques Industriels', scores: [0.6, 0.4, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 0.2, 0.8, 0.6, 0.6, 0.4, 0.4, 0.4, 0.2, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.6, 0.6, 0.8] },
    { id: 'mp16', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Systèmes manufacturiers', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0, 0.4, 0.4, 0.6, 0.4, 0.6, 0.6, 0.2, 0.8, 0.6, 0.2, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp17', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Optimisation des réseaux', scores: [0, 0, 0, 0, 0.2, 0.2, 0.2, 0.4, 0, 0, 0.4, 0.8, 0.8, 0.8, 0.6, 0.4, 1, 0.4, 0.6, 0.6, 1, 0.6, 0.8, 0.6] },
    { id: 'mp18', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Créativité et Lean Management', scores: [0, 0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0.2, 0.4, 0.6, 0.4, 0.6, 0.6, 0.2, 0.8, 0.8, 0.4, 0.2, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp19', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Evaluation des performances des systèmes', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.2, 0.6, 0.8, 0.6, 0.8, 0.6, 0.4, 1, 0.8, 0.6, 0.2, 0.4, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp20', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Ingénierie des SI Logistique et Industriels', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0, 0.2, 0.4, 0.6, 0.6, 0.6, 0.4, 0.8, 0.6, 0.2, 0.4, 1, 0.6, 0.6, 0.4, 0.4] },
    { id: 'mp21', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S2', nameFr: 'Conception des SIL et Gestion des entrepôts', scores: [0, 0, 0, 0, 0, 0.4, 0.6, 0.6, 0, 0, 0.4, 0.6, 0.4, 0.6, 0.8, 0.4, 0.8, 0.6, 0.2, 0.4, 0.8, 1, 0.4, 0.6, 0.4] },
    { id: 'mp22', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Innovation et Développement durable', scores: [0.2, 0.2, 0.2, 0, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.6, 0.4, 0.4, 0.4, 0.4, 0.6, 0.8, 0.4, 0.4, 0.6, 0.4, 0.4, 0.8] },
    { id: 'mp23', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Energies nouvelles et renouvelables (ISO 50001)', scores: [0.2, 0.2, 0, 0, 0.2, 0.2, 0.2, 0.2, 0, 0.2, 0.4, 0.4, 0.2, 0.2, 0.4, 0.2, 0.6, 0.8, 0.2, 0.2, 0.4, 0.4, 0.2, 0.6] },
    { id: 'mp24', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Analyse des données', scores: [0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 0.8, 0.6, 0.8, 0.2, 0.4, 0.8, 0.4, 0.4, 0.6] },
    { id: 'mp25', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Maîtrise des Processus industriels', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.4, 0, 0.4, 0.4, 0.6, 0.4, 0.6, 0.4, 0.2, 0.8, 0.8, 0.2, 0.2, 0.8, 0.4, 0.4, 0.4] },
    { id: 'mp26', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Logistique de Transport et Distribution', scores: [0.8, 0.8, 0.2, 0.2, 0.4, 0.6, 0.4, 0.6, 0.2, 0, 0.6, 1, 1, 0.8, 0.8, 0.6, 0.8, 0.6, 0.8, 0.6, 1, 0.8, 0.8, 0.8] },
    { id: 'mp27', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Outils d\'aide à la décision industrielle et Logistique', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0.2, 0.4, 0.8, 0.6, 0.8, 0.6, 0.4, 1, 0.6, 0.4, 0.4, 1, 0.6, 0.6, 0.6] },
    { id: 'mp28', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Analyse et Simulation des chaînes logistiques', scores: [0, 0, 0, 0, 0, 0.2, 0.4, 0.6, 0, 0, 0.4, 0.6, 0.6, 0.8, 0.6, 0.4, 1, 0.4, 0.4, 0.4, 1, 0.8, 0.6, 0.6] },
    { id: 'mp29', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Management et pilotage des projets', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.2, 0, 0, 0.4, 0.8, 0.4, 0.6, 0.4, 0.4, 0.8, 0.6, 0.8, 0.2, 0.2, 0.8, 0.6, 0.8, 0.6, 0.4, 0.4] },
    { id: 'mp30', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'TDB des SIL', scores: [0, 0, 0, 0, 0, 0.2, 0.2, 0.4, 0, 0.2, 0.6, 0.8, 0.4, 0.6, 0.6, 0.4, 0.8, 0.8, 0.2, 0.2, 0.8, 0.6, 0.4, 0.6, 0.4] },
    { id: 'mp31', filiere: 'Master_Pro_Génie_Industriel_et_Logistique', semestre: 'S3', nameFr: 'Accréditation, Certification et Audit', scores: [0.2, 0.2, 0.2, 0.2, 0.2, 0.4, 0.4, 0.4, 0.2, 0.4, 0.6, 0.8, 0.4, 0.4, 0.6, 0.4, 0.8, 1, 0.4, 0.4, 0.8, 0.6, 0.6, 0.6] },
     
  ];

 filiereOptions = computed(() => {
    const rawFilieres = this.allMatieres.map(m => m.filiere);
    const uniqueFilieres = Array.from(new Set(rawFilieres));
    
    const currentNiveau = this.selectedNiveau();
    if (currentNiveau === 'Toutes') return ['Toutes', ...uniqueFilieres];
    
    // Filtrage simple : Licences vs Masters
    const filtered = uniqueFilieres.filter(f => f.toLowerCase().includes(currentNiveau.toLowerCase().slice(0, -1)));
    return ['Toutes', ...filtered];
  });

  /**
   * Filtre la liste complète des matières selon les 3 critères (Niveau, Filière, Recherche)
   */
  filteredMatieres = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const niveau = this.selectedNiveau();
    const filiere = this.selectedFiliere();

    return this.allMatieres.filter(mat => {
      const matchSearch = query === '' || mat.nameFr.toLowerCase().includes(query);
      const matchNiveau = niveau === 'Toutes' || mat.filiere.toLowerCase().includes(niveau.toLowerCase().slice(0, -1));
      const matchFiliere = filiere === 'Toutes' || mat.filiere === filiere;
      
      return matchSearch && matchNiveau && matchFiliere;
    });
  });

  /**
   * Gère la liste à afficher (tronquée ou complète)
   */
  get visibleMatieres(): Matiere[] {
    const filtered = this.filteredMatieres();
    return this.showAll() ? filtered : filtered.slice(0, this.INITIAL_MATIERES);
  }

  /**
   * Placeholder dynamique pour la barre de recherche
   */
  get searchPlaceholder(): string {
    return this.selectedFiliere() !== 'Toutes' ? this.selectedFiliere() : 'toutes les matières';
  }

  // --- Méthodes d'Action ---

  setNiveau(niveau: string) {
    this.selectedNiveau.set(niveau);
    this.selectedFiliere.set('Toutes'); // Reset la filière quand on change de niveau
  }

  setFiliere(filiere: string) {
    this.selectedFiliere.set(filiere);
  }

  onSearchInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  toggleShowAll() {
    this.showAll.update(v => !v);
  }

  resetFilters() {
    this.selectedNiveau.set('Toutes');
    this.selectedFiliere.set('Toutes');
    this.searchQuery.set('');
    this.showAll.set(false);
  }

  // --- Helpers de Template ---

  getScore(mat: Matiere, index: number): number {
    return mat.scores[index] || 0;
  }

  getScoreClass(score: number): string {
    if (score === 0) return 'score-0';
    if (score <= 0.2) return 'score-02';
    if (score <= 0.4) return 'score-04';
    if (score <= 0.6) return 'score-06';
    if (score <= 0.8) return 'score-08';
    return 'score-10';
  }

  getScoreLabel(score: number): string {
    if (score === 0) return 'Non pertinent';
    if (score <= 0.2) return 'Complémentaire';
    if (score <= 0.4) return 'Utile';
    if (score <= 0.6) return 'Important';
    if (score <= 0.8) return 'Très important';
    return 'Fondamental';
  }

getFiliereCode(filiere: string): string {
  if (filiere.includes('Transport')) return 'LST';
  if (filiere.includes('Génie_Logistique') || filiere.includes('Génie Logistique')) return 'LGL';
  if (filiere.includes('Recherche')) return 'MR';
  if (filiere.includes('Pro')) return 'MP';
  return 'FIL';
}

getFiliereColorClass(filiere: string): string {
  if (filiere.includes('Transport')) return 'badge-lst';
  if (filiere.includes('Génie_Logistique') || filiere.includes('Génie Logistique')) return 'badge-lgl';
  if (filiere.includes('Recherche')) return 'badge-mr';
  if (filiere.includes('Pro')) return 'badge-mp';
  return 'badge-default';
}

  trackById(index: number, item: any): string {
    return item.id;
  }
}
