export interface CodeQLConfig {
  paths?: string[];
  'paths-ignore'?: string[];
  'query-filters'?: QueryFilter[];
  language?: string;
}

export interface QueryFilter {
  exclude?: {
    id?: string;
  };
}

export interface FilterOptions {
  includePatterns?: string;
  excludePatterns?: string;
  config?: CodeQLConfig;
}

export interface CodeQLResult {
  ruleId: string;
  message: {
    text: string;
  };
  partialFingerprints?: Record<string, string>;
  locations?: Array<{
    physicalLocation: {
      artifactLocation: {
        uri: string;
      };
      region: {
        startLine: number;
      };
    };
    message?: {
      text: string;
    };
  }>;
}

export interface SarifRun {
  results?: CodeQLResult[];
}

export interface SarifReport {
  runs?: SarifRun[];
}

export interface IssueData {
  title: string;
  body: string;
  labels: string[];
}

export interface QueryPack {
  language: string;
  profile: string;
  pack: string;
}

export interface AnalysisInputs {
  language: string;
  qlsProfile: string;
  includePatterns?: string;
  excludePatterns?: string;
  configFile?: string;
  token: string;
}
