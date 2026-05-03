import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface Poste {
  id: number;
  titre: string;
  description: string;
  nbEtudiants: number;
  statut: 'ouvert' | 'fermé';
  dateCreation: string;
}

export interface Entreprise {
  id: number;
  initiales: string;
  couleur: string;
  nom: string;
  secteur: string;
  nbPostes: number;
  dateDepuis: string;
  statut: 'validée' | 'en_attente';
  localisation?: string;
  dateAjout?: string;
  postes?: Poste[];
}

@Component({
  selector: 'app-gestion-entreprise',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gestion_entreprise.html',
  styleUrls: ['./gestion_entreprise.css']
})
export class GestionEntrepriseComponent implements OnInit {

  searchQuery = '';
  activeTab: 'en_attente' | 'validées' = 'validées';

  selectedEntreprise: Entreprise | null = null;
  showPostesModal = false;
  showConfirmSupp = false;
  entrepriseToSupp: Entreprise | null = null;

  entreprisesEnAttente: Entreprise[] = [
    {
      id: 101,
      initiales: 'SE',
      couleur: '#a855f7',
      nom: 'Sfax Express',
      secteur: 'Transport routier',
      nbPostes: 0,
      dateDepuis: '',
      statut: 'en_attente',
      localisation: 'Sfax, Tunisie',
      dateAjout: 'il y a 2h'
    },
    {
      id: 102,
      initiales: 'MC',
      couleur: '#10b981',
      nom: 'MedLog Cargo',
      secteur: 'Logistique maritime',
      nbPostes: 0,
      dateDepuis: '',
      statut: 'en_attente',
      localisation: 'Tunis',
      dateAjout: 'il y a 5h'
    },
    {
      id: 103,
      initiales: 'R',
      couleur: '#3b82f6',
      nom: 'RapidStock',
      secteur: 'Gestion d\'entrepôt',
      nbPostes: 0,
      dateDepuis: '',
      statut: 'en_attente',
      localisation: 'Bizerte',
      dateAjout: 'Hier'
    }
  ];

  entreprisesValidees: Entreprise[] = [
    {
      id: 1,
      initiales: 'L',
      couleur: '#0ea5e9',
      nom: 'LogiTrans',
      secteur: 'Supply Chain',
      nbPostes: 8,
      dateDepuis: 'Mars 2025',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Responsable logistique', description: 'Gestion des flux logistiques', nbEtudiants: 3, statut: 'ouvert', dateCreation: '01/03/2025' },
        { id: 2, titre: 'Chef de projet supply chain', description: 'Coordination des projets SC', nbEtudiants: 5, statut: 'ouvert', dateCreation: '10/03/2025' },
        { id: 3, titre: 'Analyste transport', description: 'Analyse des coûts transport', nbEtudiants: 2, statut: 'ouvert', dateCreation: '15/03/2025' },
        { id: 4, titre: 'Gestionnaire entrepôt', description: 'Supervision des opérations entrepôt', nbEtudiants: 4, statut: 'ouvert', dateCreation: '20/03/2025' },
        { id: 5, titre: 'Technicien SAV', description: 'Support après vente clients', nbEtudiants: 1, statut: 'fermé', dateCreation: '22/03/2025' },
        { id: 6, titre: 'Coordinateur douane', description: 'Gestion des formalités douanières', nbEtudiants: 2, statut: 'ouvert', dateCreation: '25/03/2025' },
        { id: 7, titre: 'Opérateur de saisie', description: 'Saisie des données logistiques', nbEtudiants: 0, statut: 'ouvert', dateCreation: '28/03/2025' },
        { id: 8, titre: 'Responsable planning', description: 'Planification des livraisons', nbEtudiants: 3, statut: 'ouvert', dateCreation: '30/03/2025' },
      ]
    },
    {
      id: 2,
      initiales: 'CC',
      couleur: '#10b981',
      nom: 'Carthage Cargo',
      secteur: 'Transport maritime',
      nbPostes: 5,
      dateDepuis: 'Févr. 2025',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Agent maritime', description: 'Gestion des escales navires', nbEtudiants: 2, statut: 'ouvert', dateCreation: '05/02/2025' },
        { id: 2, titre: 'Transitaire', description: 'Organisation des expéditions', nbEtudiants: 4, statut: 'ouvert', dateCreation: '10/02/2025' },
        { id: 3, titre: 'Acconier', description: 'Opérations de manutention portuaire', nbEtudiants: 1, statut: 'ouvert', dateCreation: '15/02/2025' },
        { id: 4, titre: 'Responsable fret', description: 'Coordination fret maritime', nbEtudiants: 3, statut: 'ouvert', dateCreation: '20/02/2025' },
        { id: 5, titre: 'Documentaliste export', description: 'Gestion documentaire export', nbEtudiants: 0, statut: 'fermé', dateCreation: '25/02/2025' },
      ]
    },
    {
      id: 3,
      initiales: 'NL',
      couleur: '#a855f7',
      nom: 'Numidia Logistics',
      secteur: 'Distribution',
      nbPostes: 12,
      dateDepuis: 'Janv. 2025',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Livreur', description: 'Livraisons derniers kilomètres', nbEtudiants: 6, statut: 'ouvert', dateCreation: '05/01/2025' },
        { id: 2, titre: 'Responsable réseau', description: 'Gestion réseau distribution', nbEtudiants: 2, statut: 'ouvert', dateCreation: '10/01/2025' },
        { id: 3, titre: 'Préparateur commandes', description: 'Préparation des commandes clients', nbEtudiants: 5, statut: 'ouvert', dateCreation: '12/01/2025' },
        { id: 4, titre: 'Superviseur entrepôt', description: 'Supervision équipe entrepôt', nbEtudiants: 1, statut: 'ouvert', dateCreation: '15/01/2025' },
        { id: 5, titre: 'Commercial terrain', description: 'Développement réseau commercial', nbEtudiants: 3, statut: 'ouvert', dateCreation: '18/01/2025' },
        { id: 6, titre: 'Chauffeur PL', description: 'Transport poids lourds national', nbEtudiants: 4, statut: 'ouvert', dateCreation: '20/01/2025' },
        { id: 7, titre: 'Technicien informatique', description: 'Maintenance systèmes info', nbEtudiants: 0, statut: 'fermé', dateCreation: '22/01/2025' },
        { id: 8, titre: 'Gestionnaire stock', description: 'Gestion et inventaire des stocks', nbEtudiants: 2, statut: 'ouvert', dateCreation: '25/01/2025' },
        { id: 9, titre: 'Agent de quai', description: 'Réception et expédition marchandises', nbEtudiants: 1, statut: 'ouvert', dateCreation: '27/01/2025' },
        { id: 10, titre: 'Responsable qualité', description: 'Contrôle qualité des livraisons', nbEtudiants: 2, statut: 'ouvert', dateCreation: '28/01/2025' },
        { id: 11, titre: 'Coordinateur hub', description: 'Coordination hub logistique', nbEtudiants: 0, statut: 'ouvert', dateCreation: '29/01/2025' },
        { id: 12, titre: 'Planificateur tournées', description: 'Optimisation tournées livreurs', nbEtudiants: 3, statut: 'ouvert', dateCreation: '30/01/2025' },
      ]
    },
    {
      id: 4,
      initiales: 'SR',
      couleur: '#ec4899',
      nom: 'Sahara Routes',
      secteur: 'Transport routier',
      nbPostes: 3,
      dateDepuis: 'Déc. 2024',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Chauffeur longue distance', description: 'Transport international routier', nbEtudiants: 2, statut: 'ouvert', dateCreation: '01/12/2024' },
        { id: 2, titre: 'Dispatcher', description: 'Gestion et suivi des véhicules', nbEtudiants: 1, statut: 'ouvert', dateCreation: '10/12/2024' },
        { id: 3, titre: 'Mécanicien PL', description: 'Maintenance parc véhicules', nbEtudiants: 0, statut: 'fermé', dateCreation: '15/12/2024' },
      ]
    },
    {
      id: 5,
      initiales: 'BS',
      couleur: '#0ea5e9',
      nom: 'BlueWave Shipping',
      secteur: 'Logistique maritime',
      nbPostes: 7,
      dateDepuis: 'Nov. 2024',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Capitaine de port', description: 'Supervision opérations portuaires', nbEtudiants: 1, statut: 'ouvert', dateCreation: '01/11/2024' },
        { id: 2, titre: 'Officier de navigation', description: 'Navigation et sécurité maritime', nbEtudiants: 2, statut: 'ouvert', dateCreation: '05/11/2024' },
        { id: 3, titre: 'Agent de fret', description: 'Gestion fret international', nbEtudiants: 3, statut: 'ouvert', dateCreation: '10/11/2024' },
        { id: 4, titre: 'Responsable conteneurs', description: 'Gestion parc conteneurs', nbEtudiants: 1, statut: 'ouvert', dateCreation: '15/11/2024' },
        { id: 5, titre: 'Inspecteur maritime', description: 'Contrôle conformité navires', nbEtudiants: 0, statut: 'fermé', dateCreation: '18/11/2024' },
        { id: 6, titre: 'Shipchandler', description: 'Approvisionnement navires', nbEtudiants: 2, statut: 'ouvert', dateCreation: '20/11/2024' },
        { id: 7, titre: 'Courtier maritime', description: 'Négociation affrètement', nbEtudiants: 1, statut: 'ouvert', dateCreation: '25/11/2024' },
      ]
    },
    {
      id: 6,
      initiales: 'T',
      couleur: '#f59e0b',
      nom: 'TerraStock',
      secteur: 'Entreposage',
      nbPostes: 4,
      dateDepuis: 'Oct. 2024',
      statut: 'validée',
      postes: [
        { id: 1, titre: 'Magasinier', description: 'Gestion des stocks entrepôt', nbEtudiants: 4, statut: 'ouvert', dateCreation: '01/10/2024' },
        { id: 2, titre: 'Cariste', description: 'Manutention chariots élévateurs', nbEtudiants: 2, statut: 'ouvert', dateCreation: '05/10/2024' },
        { id: 3, titre: 'Chef d\'entrepôt', description: 'Supervision équipe entrepôt', nbEtudiants: 1, statut: 'ouvert', dateCreation: '10/10/2024' },
        { id: 4, titre: 'Inventoriste', description: 'Inventaire et suivi des stocks', nbEtudiants: 0, statut: 'fermé', dateCreation: '15/10/2024' },
      ]
    }
  ];

  // ✅ Getters utilisés dans le HTML
  get nbEnAttente(): number {
    return this.entreprisesEnAttente.length;
  }

  get nbValidees(): number {
    return this.entreprisesValidees.length;
  }

  get totalPostes(): number {
    return this.entreprisesValidees.reduce((s, e) => s + e.nbPostes, 0);
  }

  get filteredValidees(): Entreprise[] {
    if (!this.searchQuery.trim()) return this.entreprisesValidees;
    const q = this.searchQuery.toLowerCase();
    return this.entreprisesValidees.filter(e =>
      e.nom.toLowerCase().includes(q) || e.secteur.toLowerCase().includes(q)
    );
  }

  get filteredEnAttente(): Entreprise[] {
    if (!this.searchQuery.trim()) return this.entreprisesEnAttente;
    const q = this.searchQuery.toLowerCase();
    return this.entreprisesEnAttente.filter(e =>
      e.nom.toLowerCase().includes(q) || e.secteur.toLowerCase().includes(q)
    );
  }

  // ✅ Corrigé : accepte Entreprise | null (utilisé avec selectedEntreprise! dans le HTML)
  getTotalEtudiants(entreprise: Entreprise | null): number {
    if (!entreprise) return 0;
    return entreprise.postes?.reduce((s, p) => s + p.nbEtudiants, 0) ?? 0;
  }

  // ✅ Ouvre la modale postes
  ouvrirPostes(entreprise: Entreprise): void {
    this.selectedEntreprise = entreprise;
    this.showPostesModal = true;
  }

  // ✅ Ferme la modale postes
  fermerModal(): void {
    this.showPostesModal = false;
    this.selectedEntreprise = null;
  }

  // ✅ Déclenche la confirmation de suppression
  confirmerSuppAcces(entreprise: Entreprise): void {
    this.entrepriseToSupp = entreprise;
    this.showConfirmSupp = true;
  }

  // ✅ Confirme la suppression
  supprimerAcces(): void {
    if (this.entrepriseToSupp) {
      this.entreprisesValidees = this.entreprisesValidees.filter(
        e => e.id !== this.entrepriseToSupp!.id
      );
      this.showConfirmSupp = false;
      this.showPostesModal = false;
      this.entrepriseToSupp = null;
      this.selectedEntreprise = null;
    }
  }

  // ✅ Annule la suppression
  annulerSupp(): void {
    this.showConfirmSupp = false;
    this.entrepriseToSupp = null;
  }

  // ✅ Valide une entreprise en attente → la déplace vers validées
  validerEntreprise(entreprise: Entreprise): void {
    this.entreprisesEnAttente = this.entreprisesEnAttente.filter(
      e => e.id !== entreprise.id
    );
    const validated: Entreprise = {
      ...entreprise,
      statut: 'validée',
      nbPostes: 0,
      dateDepuis: new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
      postes: []
    };
    this.entreprisesValidees = [...this.entreprisesValidees, validated];
  }

  // ✅ Rejette une entreprise en attente
  rejeterEntreprise(entreprise: Entreprise): void {
    this.entreprisesEnAttente = this.entreprisesEnAttente.filter(
      e => e.id !== entreprise.id
    );
  }

  ngOnInit(): void {}
}