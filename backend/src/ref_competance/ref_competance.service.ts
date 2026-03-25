import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, Document, MongoClient } from 'mongodb';

type ReferentielRow = {
  code: string;
  competence: string;
  categorie: string;
  domaine: string;
};

@Injectable()
export class RefCompetanceService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(RefCompetanceService.name);
  private readonly mongoUris: string[];
  private readonly dbName: string;

  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private connectPromise: Promise<Db> | null = null;

  constructor(private readonly configService: ConfigService) {
    const configuredPrimaryUri = this.configService.get<string>('MONGO_URI')?.trim();
    const configuredFallbackUri = this.configService
      .get<string>('MONGO_URI_FALLBACK')
      ?.trim();

    this.mongoUris = [configuredPrimaryUri, configuredFallbackUri]
      .filter((value): value is string => Boolean(value && value.length > 0))
      .filter((value, index, values) => values.indexOf(value) === index);

    this.dbName =
      this.configService.get<string>('MONGO_DB_NAME') ??
      'referentiel_competences';
  }

  onModuleInit(): void {
    if (this.mongoUris.length > 0) {
      return;
    }

    this.logger.error(
      'MongoDB URI is missing. Set MONGO_URI in backend/.env (or MONGO_URI_FALLBACK as secondary).',
    );
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

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connectWithFallback();

    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async connectWithFallback(): Promise<Db> {
    let lastError: unknown;

    for (const uri of this.mongoUris) {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 6000,
        connectTimeoutMS: 6000,
      });

      try {
        await client.connect();
        this.mongoClient = client;
        this.db = client.db(this.dbName);
        this.logger.log(`Connected to MongoDB database: ${this.dbName}`);
        return this.db;
      } catch (error) {
        lastError = error;
        await client.close().catch(() => undefined);

        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`MongoDB connection attempt failed for URI: ${uri}. ${message}`);
      }
    }

    if (this.mongoUris.length === 0) {
      throw new ServiceUnavailableException(
        `Unable to connect to MongoDB (${this.dbName}). Missing MONGO_URI configuration.`,
      );
    }

    const lastErrorMessage =
      lastError instanceof Error ? lastError.message : 'Unknown MongoDB error';

    throw new ServiceUnavailableException(
      `Unable to connect to MongoDB (${this.dbName}). Last error: ${lastErrorMessage}`,
    );
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
