export type RecommendationLevel = 'CRITIQUE' | 'HAUTE' | 'MOYENNE';
export type RecommendationStatus = 'PENDING' | 'CONFIRMED' | 'DELETED';

export type CertificationPayload = {
  title: string;
  description?: string;
  provider: string;
  duration: string;
  pricing: string;
  url?: string;
};

export type RecommendationItem = {
  id: string;
  category: string;
  gapLabel: string;
  gapTitle: string;
  level: RecommendationLevel;
  metier: string;
  keywords: string[];
  concernRate: number;
  studentsImpacted: number;
  totalStudents: number;
  llmRecommendation: string;
  certification: CertificationPayload;
  status: RecommendationStatus;
};

export type RecommendationOverride = {
  status?: RecommendationStatus;
  certification?: CertificationPayload;
};

export type GapStatisticsPayload = {
  competence_name?: unknown;
  metier_name?: unknown;
  domaine_name?: unknown;
  competence_type?: unknown;
  keywords?: unknown;
  n_gap?: unknown;
  n_students_total?: unknown;
  pct_students?: unknown;
  avg_similarity?: unknown;
  student_ids?: unknown;
};

export type RagKnowledgePayload = {
  doc_type?: unknown;
  source?: unknown;
  titre?: unknown;
  text?: unknown;
  plateforme?: unknown;
  url?: unknown;
  duree_heures?: unknown;
  duree?: unknown;
  cout?: unknown;
  niveau?: unknown;
  metier?: unknown;
  competences?: unknown;
  recommande_pour?: unknown;
  certifications?: unknown;
};
