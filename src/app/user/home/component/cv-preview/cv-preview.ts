import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cv-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-preview.html',
  styleUrl: './cv-preview.css'
})
export class CvPreview {
  @Input() cv: any | null = null;
  @Input() profile: any | null = null; // optional user profile for name/contact

  get fullName(): string {
    if (this.profile && this.profile.displayName) return this.profile.displayName;
    if (this.cv && this.cv.info && (this.cv.info.nom || this.cv.info.prenom)) {
      return `${this.cv.info.prenom || ''} ${this.cv.info.nom || ''}`.trim();
    }
    return 'Votre nom complet';
  }

  infoField(field: string): any {
    // Try direct cv.info property
    if (this.cv && this.cv.info) {
      if (field in this.cv.info && this.cv.info[field]) return this.cv.info[field];
      // try common snake_case/camelCase variants
      const variants = [field, field.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase()), field.replace(/_/g, '')];
      for (const v of variants) {
        for (const k of Object.keys(this.cv.info)) {
          if (k === v) return this.cv.info[k];
          if (k.replace(/_/g, '').toLowerCase() === v.replace(/_/g, '').toLowerCase()) return this.cv.info[k];
        }
      }
    }

    // If profile is structured StudentProfileData, search infoGroups and summaryItems
    try {
      if (this.profile && Array.isArray(this.profile.infoGroups)) {
        const target = field.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const g of this.profile.infoGroups || []) {
          for (const it of g.items || []) {
            const label = String(it.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!label) continue;
            if (label === target || label.includes(target) || target.includes(label)) return it.value || '';
          }
        }
        for (const it of this.profile.summaryItems || []) {
          const label = String(it.label || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!label) continue;
          if (label === target || label.includes(target) || target.includes(label)) return it.value || '';
        }
      }
    } catch {
      // ignore
    }

    // fallback to plain profile object keys
    if (this.profile && typeof this.profile === 'object') {
      for (const k of Object.keys(this.profile)) {
        if (k === field) return this.profile[k as keyof typeof this.profile];
        if (k.replace(/_/g, '').toLowerCase() === field.replace(/_/g, '').toLowerCase()) return this.profile[k as keyof typeof this.profile];
      }
    }

    return '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cv'] && this.cv) {
      this.normalizeCv(this.cv);
      try { console.debug('[CvPreview] normalized cv:', this.cv); } catch {}
    }
  }

  private normalizeCv(cv: any): void {
    if (!cv || typeof cv !== 'object') return;

    // normalize top-level info keys to common names
    if (cv.info && typeof cv.info === 'object') {
      const info = cv.info;
      if (!('email' in info) && 'email_institutionnel' in info) info.email = info.email_institutionnel;
      if (!('telephone' in info) && 'telephone' in info) info.telephone = info.telephone;
      if (!('ville' in info) && 'ville' in info) info.ville = info.ville;
      if (!('codePostal' in info) && 'code_postal' in info) info.codePostal = info.code_postal;
      if (!('linkedin' in info) && 'linkedin_url' in info) info.linkedin = info.linkedin_url;
      if (!('permis' in info) && 'permis_de_conduire' in info) info.permis = info.permis_de_conduire;
      if (!('dateNaissance' in info) && 'date_naissance' in info) info.dateNaissance = info.date_naissance;
    }

    const mapDates = (obj: any, fromStartKeys: string[], fromEndKeys: string[]) => {
      if (!obj || typeof obj !== 'object') return;
      if (!('dateDebut' in obj)) {
        for (const k of fromStartKeys) if (k in obj && obj[k]) { obj.dateDebut = obj[k]; break; }
      }
      if (!('dateFin' in obj)) {
        for (const k of fromEndKeys) if (k in obj && obj[k]) { obj.dateFin = obj[k]; break; }
      }
    };

    // formations
    if (Array.isArray(cv.formations)) {
      cv.formations.forEach((f: any) => {
        mapDates(f, ['dateDebut', 'date_debut', 'startDate', 'start_date'], ['dateFin', 'date_fin', 'endDate', 'end_date']);
        if (!('pfeTitre' in f) && 'pfe_titre' in f) f.pfeTitre = f.pfe_titre;
        if (!('pfeEntreprise' in f) && 'pfe_entreprise' in f) f.pfeEntreprise = f.pfe_entreprise;
        if (!('pfeTechnologies' in f) && 'pfe_technologies' in f) f.pfeTechnologies = f.pfe_technologies;
        if (!('diplome' in f) && 'diploma' in f) f.diplome = f.diploma;
      });
    }

    // experiences
    if (Array.isArray(cv.experiences)) {
      cv.experiences.forEach((e: any) => {
        mapDates(e, ['dateDebut', 'date_debut', 'startDate', 'start_date'], ['dateFin', 'date_fin', 'endDate', 'end_date']);
        if (!('poste' in e) && ('titre' in e || 'jobTitle' in e)) e.poste = e.titre ?? e.jobTitle;
        if (!('entreprise' in e) && ('entreprise' in e)) e.entreprise = e.entreprise;
        if (!('motsCles' in e) && 'mots_cles' in e) e.motsCles = e.mots_cles;
        if (!('lieu' in e) && ('location' in e)) e.lieu = e.location;
      });
    }

    // projets
    if (Array.isArray(cv.projets)) {
      cv.projets.forEach((p: any) => {
        if (!('titre' in p) && 'title' in p) p.titre = p.title;
        if (!('technologies' in p) && 'tech' in p) p.technologies = p.tech;
      });
    }

    // certifications
    if (Array.isArray(cv.certifications)) {
      cv.certifications.forEach((c: any) => {
        if (!('date' in c) && 'date_obtenue' in c) c.date = c.date_obtenue;
      });
    }

    // engagements
    if (Array.isArray(cv.engagements)) {
      cv.engagements.forEach((en: any) => {
        mapDates(en, ['dateDebut', 'date_debut', 'startDate'], ['dateFin', 'date_fin', 'endDate']);
      });
    }

    // skills: leave as-is but ensure nom/niveau exist
    if (Array.isArray(cv.hardSkills)) {
      cv.hardSkills.forEach((s: any) => {
        if (!('nom' in s) && 'name' in s) s.nom = s.name;
        if (!('niveau' in s) && 'level' in s) s.niveau = s.level;
      });
    }
    if (Array.isArray(cv.softSkills)) {
      cv.softSkills.forEach((s: any) => {
        if (!('nom' in s) && 'name' in s) s.nom = s.name;
        if (!('niveau' in s) && 'level' in s) s.niveau = s.level;
      });
    }
  }

  get interestLabels(): string | null {
    try {
      const arr = this.profile?.interests ?? [];
      return Array.isArray(arr) ? arr.map((i: any) => i.label).filter((l: any) => !!l).join(', ') : null;
    } catch {
      return null;
    }
  }
}
