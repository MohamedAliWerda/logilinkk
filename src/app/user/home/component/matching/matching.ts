import { Component } from '@angular/core';
import { ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type MatchingCompany = {
  name: string;
  location: string;
  score: number;
  description: string;
  tags: string[];
  sector: string;
  employees: string;
  stage: string;
};

@Component({
  selector: 'app-matching',
  imports: [CommonModule, FormsModule],
  templateUrl: './matching.html',
  styleUrl: './matching.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Matching {
  matchingSearch = '';

  readonly matchingCompanies: MatchingCompany[] = [
    {
      name: 'Sotrapil',
      location: 'Sfax',
      score: 92,
      description:
        'Leader tunisien du transport de produits petroliers par pipeline.',
      tags: ['Logistique', 'Transport', 'SAP'],
      sector: 'Transport petrolier',
      employees: '500+ employes',
      stage: 'Stage PFE',
    },
    {
      name: 'CTN',
      location: 'Tunis',
      score: 87,
      description: 'Compagnie nationale de navigation maritime.',
      tags: ['Maritime', 'Supply Chain', 'Commerce international'],
      sector: 'Transport maritime',
      employees: '1000+ employes',
      stage: 'Stage PFE',
    },
    {
      name: 'Tunisie Telecom',
      location: 'Tunis',
      score: 80,
      description:
        'Optimisation des operations supply chain et logistique telecom.',
      tags: ['Supply Chain', 'Data', 'ERP'],
      sector: 'Telecommunications',
      employees: '2000+ employes',
      stage: 'Stage ingenieur',
    },
    {
      name: 'STAM',
      location: 'Rades',
      score: 84,
      description: 'Gestion portuaire, transit et operations de manutention.',
      tags: ['Portuaire', 'Transport', 'Operations'],
      sector: 'Logistique portuaire',
      employees: '700+ employes',
      stage: 'Stage technicien',
    },
  ];

  get filteredMatchingCompanies(): MatchingCompany[] {
    const query = this.matchingSearch.trim().toLowerCase();

    if (!query) {
      return this.matchingCompanies;
    }

    return this.matchingCompanies.filter(
      ({ name, location, tags, sector }) =>
        name.toLowerCase().includes(query) ||
        location.toLowerCase().includes(query) ||
        sector.toLowerCase().includes(query) ||
        tags.some((tag) => tag.toLowerCase().includes(query))
    );
  }
}
