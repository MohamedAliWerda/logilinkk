import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Job {
  title: string;
  type: string;
  selected: boolean;
  company: string;
  location: string;
  source: string;
  salaryMin: string;
  salaryMax: string;
  description: string;
  skills: string[];
}

@Component({
  selector: 'app-offres-emp',
  standalone: true,
  imports: [CommonModule, FormsModule],  // ✅ FormsModule ajouté
  templateUrl: './offres-emp.html',
  styleUrls: ['./offres-emp.css']
})
export class OffresEmpComponent {

  searchQuery = '';  // ✅ ajouté pour la barre de recherche

  logitransJobs: Job[] = [
    {
      title: 'Gestionnaire de stock',
      type: 'Stage PFE',
      selected: false,
      company: 'LogiTrans',
      location: 'Tunis / Hybride',
      source: 'Direct',
      salaryMin: '600',
      salaryMax: '900',
      description: 'Assurer le suivi des stocks et optimiser les inventaires en temps réel au sein de notre entrepôt principal. Vous travaillerez en étroite collaboration avec l\'équipe logistique.',
      skills: ['WMS', 'Excel', 'Inventaire', 'Rigueur']
    },
    {
      title: 'Analyste Supply Chain',
      type: 'CDI',
      selected: false,
      company: 'LogiTrans',
      location: 'Tunis',
      source: 'Direct',
      salaryMin: '1800',
      salaryMax: '2500',
      description: 'Analyser et optimiser les processus de la chaîne d\'approvisionnement. Vous produirez des rapports de performance et proposerez des axes d\'amélioration continue.',
      skills: ['ERP SAP', 'Power BI', 'Analyse de données', 'Excel avancé']
    },
    {
      title: 'Coordinateur transport',
      type: 'CDI',
      selected: false,
      company: 'LogiTrans',
      location: 'Tunis',
      source: 'Direct',
      salaryMin: '1600',
      salaryMax: '2200',
      description: 'Coordonner les opérations de transport national et international. Suivi des livraisons, gestion des prestataires logistiques et optimisation des coûts de transport.',
      skills: ['TMS', 'Douane', 'Anglais', 'Négociation']
    }
  ];

  sfaxJobs: Job[] = [
    {
      title: 'Planificateur de tournées',
      type: 'Stage',
      selected: false,
      company: 'Sfax Express',
      location: 'Sfax',
      source: 'Direct',
      salaryMin: '500',
      salaryMax: '700',
      description: 'Optimiser les tournées de livraison en utilisant des outils de planification. Vous réduirez les coûts kilométriques et améliorerez les délais de livraison sur la région de Sfax.',
      skills: ['Routage', 'Excel', 'Logistique urbaine', 'Analyse']
    },
    {
      title: 'Responsable d\'exploitation',
      type: 'CDI',
      selected: false,
      company: 'Sfax Express',
      location: 'Sfax',
      source: 'Direct',
      salaryMin: '2200',
      salaryMax: '3000',
      description: 'Superviser l\'ensemble des opérations d\'exploitation du site de Sfax. Vous managerez une équipe de 15 personnes et serez garant de la qualité de service et des délais.',
      skills: ['Management', 'Transport routier', 'KPI', 'Leadership']
    }
  ];

  selectedJob: Job | null = null;  // ✅ typé correctement

  // ✅ Getter pour les jobs sélectionnés
  get selectedJobs(): Job[] {
    return [...this.logitransJobs, ...this.sfaxJobs].filter(j => j.selected);
  }

  // ✅ Getters filtrés par recherche
  get filteredLogitransJobs(): Job[] {
    if (!this.searchQuery.trim()) return this.logitransJobs;
    const q = this.searchQuery.toLowerCase();
    return this.logitransJobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q)
    );
  }

  get filteredSfaxJobs(): Job[] {
    if (!this.searchQuery.trim()) return this.sfaxJobs;
    const q = this.searchQuery.toLowerCase();
    return this.sfaxJobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.type.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q)
    );
  }

  toggleJob(job: Job): void {
    job.selected = !job.selected;
  }

  postuler(): void {
    alert(`Vous avez postulé à ${this.selectedJobs.length} offre(s)`);
  }

  openDetails(job: Job): void {
    this.selectedJob = job;
  }

  closeDetails(): void {
    this.selectedJob = null;
  }
}