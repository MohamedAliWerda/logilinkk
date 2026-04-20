import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export interface QdrantScrollResult {
  id: string;
  payload: Record<string, unknown>;
}

export interface QdrantCollectionInfo {
  status: string;
  points_count: number;
  vectors_count: number;
}

@Injectable()
export class QdrantService implements OnModuleDestroy {
  private readonly logger = new Logger(QdrantService.name);
  private readonly qdrantUrl: string;
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ?? 'https://4252fbd0-800c-46ef-9748-3e52c7b9f434.eu-central-1-0.aws.cloud.qdrant.io';
    this.apiKey = this.configService.get<string>('QDRANT_API_KEY');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('QdrantService destroyed');
  }

  // -----------------------------------------------------------------------
  // Low-level HTTP helper
  // -----------------------------------------------------------------------
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.qdrantUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Qdrant ${method} ${path} failed (${res.status}): ${text}`);
    }

    const json = (await res.json()) as { result: T };
    return json.result;
  }

  // -----------------------------------------------------------------------
  // Collection info
  // -----------------------------------------------------------------------
  async getCollectionInfo(
    collection: string,
  ): Promise<QdrantCollectionInfo> {
    return this.request<QdrantCollectionInfo>(
      'GET',
      `/collections/${encodeURIComponent(collection)}`,
    );
  }

  async listCollections(): Promise<string[]> {
    const result = await this.request<{ collections: { name: string }[] }>(
      'GET',
      '/collections',
    );
    return result.collections.map((c) => c.name);
  }

  // -----------------------------------------------------------------------
  // Search (vector similarity)
  // -----------------------------------------------------------------------
  async search(
    collection: string,
    vector: number[],
    options?: {
      limit?: number;
      filter?: Record<string, unknown>;
      with_payload?: boolean;
    },
  ): Promise<QdrantSearchResult[]> {
    const body: Record<string, unknown> = {
      vector,
      limit: options?.limit ?? 5,
      with_payload: options?.with_payload ?? true,
    };
    if (options?.filter) {
      body.filter = options.filter;
    }

    return this.request<QdrantSearchResult[]>(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/search`,
      body,
    );
  }

  // -----------------------------------------------------------------------
  // Scroll (filtered retrieval without vector)
  // -----------------------------------------------------------------------
  async scroll(
    collection: string,
    options?: {
      limit?: number;
      filter?: Record<string, unknown>;
      with_payload?: boolean;
      offset?: string | number | null;
    },
  ): Promise<{ points: QdrantScrollResult[]; next_page_offset: string | null }> {
    const body: Record<string, unknown> = {
      limit: options?.limit ?? 100,
      with_payload: options?.with_payload ?? true,
    };
    if (options?.filter) {
      body.filter = options.filter;
    }
    if (options?.offset) {
      body.offset = options.offset;
    }

    return this.request<{
      points: QdrantScrollResult[];
      next_page_offset: string | null;
    }>(
      'POST',
      `/collections/${encodeURIComponent(collection)}/points/scroll`,
      body,
    );
  }

  // -----------------------------------------------------------------------
  // Convenience: get student gaps
  // -----------------------------------------------------------------------
  async getStudentGaps(
    authId: string,
    options?: { limit?: number; metier?: string },
  ): Promise<QdrantScrollResult[]> {
    const must: Record<string, unknown>[] = [
      { key: 'auth_id', match: { value: authId } },
      { key: 'status', match: { value: 'gap' } },
    ];
    if (options?.metier) {
      must.push({ key: 'metier_name', match: { value: options.metier } });
    }

    const result = await this.scroll('student_gaps', {
      limit: options?.limit ?? 200,
      filter: { must },
    });
    return result.points;
  }

  // -----------------------------------------------------------------------
  // Convenience: get top gap statistics
  // -----------------------------------------------------------------------
  async getTopGapStatistics(
    limit = 20,
  ): Promise<QdrantScrollResult[]> {
    const result = await this.scroll('gap_statistics', { limit });
    // Sort client-side by pct_students descending
    return result.points.sort(
      (a, b) =>
        (b.payload['pct_students'] as number) -
        (a.payload['pct_students'] as number),
    );
  }

  // -----------------------------------------------------------------------
  // Convenience: RAG search for recommendations
  // -----------------------------------------------------------------------
  async searchRecommendations(
    queryVector: number[],
    options?: {
      limit?: number;
      docTypes?: string[];
    },
  ): Promise<QdrantSearchResult[]> {
    const docTypes = options?.docTypes ?? [
      'certification',
      'rncp_certification',
      'aft_referentiel',
      'market_gap',
      'recommendation_rule',
    ];

    const filter = {
      should: docTypes.map((dt) => ({
        key: 'doc_type',
        match: { value: dt },
      })),
    };

    return this.search('rag_knowledge', queryVector, {
      limit: options?.limit ?? 5,
      filter,
    });
  }
}
