import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Metier {
  name: string;
  rate: number;
}

interface Parcours {
  title: string;
  metiers: Metier[];
}

@Component({
  selector: 'app-metier-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metier_admin.html',
  styleUrl: './metier_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetierAdmin {
  readonly parcoursList: Parcours[] = [
    {
      title: 'Transport International',
      metiers: [
        { name: 'Agent de transit', rate: 82 },
        { name: 'Freight Forwarder', rate: 75 },
        { name: 'Déclarant en douane', rate: 70 },
        { name: 'Agent maritime', rate: 62 },
        { name: 'Coordinateur transport', rate: 58 },
      ],
    },
    {
      title: 'Logistique Portuaire',
      metiers: [
        { name: "Responsable d'entrepôt", rate: 78 },
        { name: 'Chef de quai', rate: 72 },
        { name: 'Coordinateur transport', rate: 65 },
        { name: 'Agent de consignation', rate: 54 },
      ],
    },
    {
      title: 'Supply Chain Management',
      metiers: [
        { name: 'Supply Chain Analyst', rate: 85 },
        { name: 'Responsable approvisionnement', rate: 79 },
        { name: 'Planificateur flux', rate: 74 },
        { name: 'Consultant logistique', rate: 68 },
      ],
    },
  ];

  trackByParcours(_: number, item: Parcours): string {
    return item.title;
  }

  trackByMetier(_: number, item: Metier): string {
    return item.name;
  }
}
