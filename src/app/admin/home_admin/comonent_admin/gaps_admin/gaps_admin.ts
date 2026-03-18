import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gaps-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gaps_admin.html',
  styleUrl: './gaps_admin.css'
})
export class GapsAdmin {
  // Chart 1: Profil -> Marché
  adequationMetier = [
    { label: 'Resp. logistique', score: 82, status: 'Aligné', color: '#5dbf7a' },
    { label: 'Supply chain analyst', score: 68, status: 'Partiel', color: '#e07800' },
    { label: 'Chef de projet TL', score: 65, status: 'Partiel', color: '#e07800' },
    { label: 'Coordinateur I/E', score: 52, status: 'Gap fort', color: '#e06456' },
    { label: 'Consultant TMS', score: 38, status: 'Gap fort', color: '#e06456' },
    { label: 'Resp. entrepôt', score: 35, status: 'Gap fort', color: '#e06456' },
  ];

  gapsBloquants = [
    { label: 'TMS / WMS', value: 4.5, color: '#e06456' },
    { label: 'Data analytics', value: 3.5, color: '#e07800' },
    { label: 'Anglais pro', value: 3.5, color: '#e07800' },
    { label: 'Lean management', value: 2, color: '#5baddb' },
    { label: 'Multimodal', value: 2, color: '#5baddb' },
    { label: 'Réglementation', value: 1, color: '#5baddb' },
  ];

  // Chart 2: Profil -> Compétences
  compTech = [
    { label: 'TMS / WMS', acquis: 28, requis: 85, status: 'Absente', gap: -57 },
    { label: 'Multimodal', acquis: 55, requis: 85, status: 'Insuffisante', gap: -30 },
    { label: 'Data supply chain', acquis: 32, requis: 80, status: 'Absente', gap: -48 },
    { label: 'Gestion des risques', acquis: 48, requis: 75, status: 'Insuffisante', gap: -27 },
  ];

  compOrga = [
    { label: 'Planification', acquis: 50, requis: 80, status: 'Insuffisante', gap: -30 },
    { label: 'Gestion du temps', acquis: 70, requis: 85, status: 'Insuffisante', gap: -15 },
    { label: 'Suivi de projet', acquis: 40, requis: 75, status: 'Insuffisante', gap: -35 },
    { label: 'Coordination', acquis: 55, requis: 70, status: 'Insuffisante', gap: -15 },
  ];

  compComp = [
    { label: 'Leadership', acquis: 50, requis: 80, status: 'Insuffisante', gap: -30 },
    { label: 'Travail en équipe', acquis: 75, requis: 80, status: 'Aligné', gap: -5 },
    { label: 'Gestion de stress', acquis: 45, requis: 75, status: 'Insuffisante', gap: -30 },
    { label: 'Adaptabilité', acquis: 65, requis: 70, status: 'Insuffisante', gap: -5 },
  ];

  compPhys = [
    { label: 'Endurance', acquis: 75, requis: 70, status: 'Aligné', gap: '+5' },
    { label: 'Force manuelle', acquis: 60, requis: 80, status: 'Insuffisante', gap: -20 },
    { label: 'Posture', acquis: 80, requis: 80, status: 'Aligné', gap: 0 },
    { label: 'Dextérité', acquis: 55, requis: 75, status: 'Insuffisante', gap: -20 },
  ];

  // Chart 3: Profil -> Modules
  couvertureModules = [
    { label: 'LOG101 - Fondamentaux', valeur: 55 },
    { label: 'TRA201 - Multimodal', valeur: 72 },
    { label: 'GES301 - Opérations', valeur: 48 },
    { label: 'INF203 - SI logistiques', valeur: 80 },
    { label: 'ECO102 - Économie TL', valeur: 38 },
  ];

  balanceModules = [
    { label: 'LOG101 - Fondamentaux', theorie: 75, pratique: 25 },
    { label: 'TRA201 - Multimodal', theorie: 60, pratique: 40 },
    { label: 'GES301 - Opérations', theorie: 80, pratique: 20 },
    { label: 'INF203 - SI logistiques', theorie: 50, pratique: 50 },
    { label: 'ECO102 - Économie TL', theorie: 90, pratique: 10 },
  ];

  constructor() {}
}
