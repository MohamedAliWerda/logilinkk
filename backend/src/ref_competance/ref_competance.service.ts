import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Document, MongoClient } from 'mongodb';

type ReferentielRow = {
  code: string;
  competence: string;
  categorie: string;
  domaine: string;
};

@Injectable()
export class RefCompetanceService implements OnModuleDestroy {
  private readonly logger = new Logger(RefCompetanceService.name);
  private readonly uri: string;
  private readonly dbName: string;

  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private readonly configService: ConfigService) {
    this.uri =
      this.configService.get<string>('MONGO_URI') ??
      'mongodb+srv://bilel-db:JbBLw3NTQf1jasuH@metier.miwjsw8.mongodb.net/';
    this.dbName =
      this.configService.get<string>('MONGO_DB_NAME') ??
      'referentiel_competences';
  }

  async getReferentielCompetences(): Promise<ReferentielRow[]> {
    const db = await this.getDatabase();

    const [competences, domaines, metiers] = await Promise.all([
      db.collection('competences').find({}).toArray(),
      db.collection('domaines').find({}).toArray(),
      db.collection('metiers').find({}).toArray(),
    ]);

    const domainLookup = this.createDomainLookup(domaines);
    const competenceDomainLookup = this.createCompetenceDomainLookup(
      metiers,
      domainLookup,
    );

    return competences.map((competence) => {
      const libelle = this.readString(competence, 'libelle');
      const typeCompetence = this.readString(competence, 'type_competence');
      const domaine = this.resolveDomainName(
        competence,
        domainLookup,
        competenceDomainLookup,
      );

      return {
        code: String(competence._id ?? ''),
        competence: libelle,
        categorie: typeCompetence,
        domaine,
      };
    });
  }

  async getMetiers(): Promise<Document[]> {
    const db = await this.getDatabase();
    const [metiers, domaines] = await Promise.all([
      db.collection('metiers').find({}).toArray(),
      db.collection('domaines').find({}).toArray(),
    ]);

    const domainLookup = this.createDomainLookup(domaines);

    return metiers.map((m) => {
      const nom = this.readString(m, 'nom_metier', this.readString(m, 'nom', 'Metier non defini'));
      const domaineId = this.readOptional(m, 'domaine_id') ?? this.readOptional(m, 'id_domaine') ?? this.readOptional(m, 'domaineId') ?? this.readOptional(m, 'domain_id');

      let domaineName = 'Domaine non defini';
      if (domaineId !== undefined && domaineId !== null) {
        const found = domainLookup.get(String(domaineId));
        if (found) domaineName = found;
      }

      return {
        _id: m._id,
        nom_metier: nom,
        domaine: domaineName,
        raw: m,
      } as Document;
    });
  }

  async getDomaines(): Promise<Document[]> {
    const db = await this.getDatabase();
    const domaines = await db.collection('domaines').find({}).toArray();
    return domaines.map((d) => ({ _id: d._id, nom_domaine: this.readString(d, 'nom_domaine', this.readString(d, 'nom', 'Domaine non defini')) } as Document));
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.mongoClient) {
      return;
    }

    await this.mongoClient.close();
    this.mongoClient = null;
    this.db = null;
  }

  private async getDatabase(): Promise<Db> {
    if (this.db) {
      return this.db;
    }

    this.mongoClient = new MongoClient(this.uri);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(this.dbName);

    this.logger.log(`Connected to MongoDB database: ${this.dbName}`);

    return this.db;
  }

  private createDomainLookup(domaines: Document[]): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const domaine of domaines) {
      const domainName = this.readString(domaine, 'nom_domaine', 'Nom Domaine inconnu');
      const keys = [
        domaine._id,
        this.readOptional(domaine, 'id_domaine'),
        this.readOptional(domaine, 'domaine_id'),
        this.readOptional(domaine, 'code_domaine'),
        this.readOptional(domaine, 'nom_domaine'),
      ]
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));

      for (const key of keys) {
        lookup.set(key, domainName);
      }
    }

    return lookup;
  }

  private resolveDomainName(
    competence: Document,
    domainLookup: Map<string, string>,
    competenceDomainLookup: Map<string, string>,
  ): string {
    const fromCompetenceId = competenceDomainLookup.get(String(competence._id ?? ''));
    if (fromCompetenceId) {
      return fromCompetenceId;
    }

    const directDomainName = this.readOptional(competence, 'nom_domaine');
    if (typeof directDomainName === 'string' && directDomainName.trim().length > 0) {
      return directDomainName;
    }

    const relationCandidates = [
      this.readOptional(competence, 'domaine_id'),
      this.readOptional(competence, 'id_domaine'),
      this.readOptional(competence, 'domaineId'),
      this.readOptional(competence, 'domain_id'),
      this.readOptional(competence, 'domaine'),
    ];

    for (const candidate of relationCandidates) {
      if (candidate === undefined || candidate === null) {
        continue;
      }

      const found = domainLookup.get(String(candidate));
      if (found) {
        return found;
      }
    }

    return 'Domaine non defini';
  }

  private createCompetenceDomainLookup(
    metiers: Document[],
    domainLookup: Map<string, string>,
  ): Map<string, string> {
    const lookup = new Map<string, string>();

    for (const metier of metiers) {
      const domaineIdCandidates = [
        this.readOptional(metier, 'domaine_id'),
        this.readOptional(metier, 'id_domaine'),
        this.readOptional(metier, 'domaineId'),
        this.readOptional(metier, 'domain_id'),
      ];

      let domaineName = 'Domaine non defini';
      for (const candidate of domaineIdCandidates) {
        if (candidate === undefined || candidate === null) {
          continue;
        }

        const found = domainLookup.get(String(candidate));
        if (found) {
          domaineName = found;
          break;
        }
      }

      const competenceIds = this.asStringArray(this.readOptional(metier, 'competences'));
      for (const competenceId of competenceIds) {
        if (!lookup.has(competenceId)) {
          lookup.set(competenceId, domaineName);
        }
      }
    }

    return lookup;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry) => entry !== undefined && entry !== null)
      .map((entry) => String(entry));
  }

  private readString(
    document: Document,
    field: string,
    fallback = 'Non defini',
  ): string {
    const value = this.readOptional(document, field);
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
  }

  private readOptional(document: Document, field: string): unknown {
    const value = document[field];
    return value;
  }
}
