import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Formation {
  code: string;
  title: string;
  description: string;
  duration: string;
  students: number;
  semester: string;
  statut: 'En cours' | 'Planifie';
}

@Component({
  selector: 'app-formations-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './formations_admin.html',
  styleUrl: './formations_admin.css',
})
export class FormationsAdmin {
  adminName = 'Nour';
  sidebarCollapsed = false;
  showAddForm = false;
  formError = '';

  newFormation: Formation = this.emptyFormation();

  formations: Formation[] = [
    {
      code: 'LOG-101',
      title: 'Gestion de la chaine logistique',
      description: 'Principes fondamentaux de la gestion logistique, planification et optimisation des flux.',
      duration: '120h',
      students: 42,
      semester: 'S3',
      statut: 'En cours',
    },
    {
      code: 'TRA-201',
      title: 'Transport international',
      description: 'Reglementations, incoterms, modes de transport et documentation internationale.',
      duration: '90h',
      students: 35,
      semester: 'S3',
      statut: 'En cours',
    },
    {
      code: 'LOG-102',
      title: 'Gestion des stocks et approvisionnement',
      description: 'Methodes de gestion des stocks, calcul des points de commande et optimisation.',
      duration: '80h',
      students: 42,
      semester: 'S3',
      statut: 'En cours',
    },
    {
      code: 'COM-301',
      title: 'Commerce international',
      description: 'Techniques du commerce international, negociation et contrats.',
      duration: '100h',
      students: 28,
      semester: 'S4',
      statut: 'En cours',
    },
    {
      code: 'TRA-202',
      title: 'Douane et reglementation',
      description: "Procedures douanieres, tarifs et reglementations a l'import/export.",
      duration: '60h',
      students: 35,
      semester: 'S4',
      statut: 'Planifie',
    },
    {
      code: 'LOG-301',
      title: "Systemes d'information logistique",
      description: 'ERP, WMS, TMS et digitalisation de la supply chain.',
      duration: '70h',
      students: 40,
      semester: 'S4',
      statut: 'Planifie',
    },
    {
      code: 'LOG-302',
      title: 'Lean Management & Qualite',
      description: 'Methodes Lean, amelioration continue et pilotage de la performance.',
      duration: '75h',
      students: 31,
      semester: 'S5',
      statut: 'En cours',
    },
    {
      code: 'LNG-101',
      title: 'Anglais professionnel logistique',
      description: 'Communication professionnelle en anglais pour la logistique et le transport.',
      duration: '45h',
      students: 52,
      semester: 'S2',
      statut: 'En cours',
    },
    {
      code: 'PFE-401',
      title: 'Projet de fin d etudes',
      description: 'Projet applique en entreprise avec encadrement academique et industriel.',
      duration: '140h',
      students: 26,
      semester: 'S6',
      statut: 'Planifie',
    },
  ];

  constructor(private router: Router) {}

  private emptyFormation(): Formation {
    return {
      code: '',
      title: '',
      description: '',
      duration: '',
      students: 0,
      semester: 'S1',
      statut: 'En cours',
    };
  }

  openAddForm() {
    this.showAddForm = true;
    this.formError = '';
    this.newFormation = this.emptyFormation();
  }

  cancelAdd() {
    this.showAddForm = false;
    this.formError = '';
  }

  addFormation() {
    const f = this.newFormation;
    if (!f.code.trim() || !f.title.trim() || !f.description.trim() || !f.duration.trim() || !f.semester.trim()) {
      this.formError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (f.students < 0) {
      this.formError = 'Le nombre d etudiants doit etre positif.';
      return;
    }

    this.formations = [
      {
        code: f.code.trim().toUpperCase(),
        title: f.title.trim(),
        description: f.description.trim(),
        duration: f.duration.trim(),
        students: Number(f.students),
        semester: f.semester.trim().toUpperCase(),
        statut: f.statut,
      },
      ...this.formations,
    ];

    this.cancelAdd();
  }

  logout() {
    this.router.navigate(['/']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
