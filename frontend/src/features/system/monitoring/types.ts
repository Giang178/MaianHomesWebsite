type HealthCheck = {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  latency_ms?: number | null;
  message: string;
  ssl_expires_at?: string;
  workers?: string[];
};

export type HealthSummary = {
  id: string;
  status: string;
  checks: HealthCheck[];
  generated_at: string;
};

type HealthSnapshot = {
  generated_at: string;
  status: string;
  checks: HealthCheck[];
};

export type HealthTimeseries = {
  items: HealthSnapshot[];
};
