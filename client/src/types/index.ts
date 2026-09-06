export type UserRole = 'admin' | 'qa_manager' | 'reliability_engineer' | 'operator' | 'fa_engineer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  personaName?: string;  // e.g. "Dr. Afrith", "Dr. Selvi"
  lastLogin?: string;
}

export interface Lot {
  id: string;
  partNumber: string;
  manufacturer: string;
  dateCode?: string;
  specReference?: string;
  quantity: number;
  createdBy: string;
  createdAt: string;
}

export type RunStatus = 'created' | 'running' | 'paused' | 'completed' | 'under_review' | 'dispositioned' | 'archived' | 'aborted';

export interface Run {
  id: string;
  lotId: string;
  lot?: Lot;
  status: RunStatus;
  speedMultiplier: number;
  anomalyInjectionConfig?: Record<string, any>;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  elapsedHours: number;
  deviceCount?: number;
  alertCount?: number;
}

export interface TelemetryReadings {
  voltage: number;
  current: number;
  leakageCurrent: number;
  temperature: number;
}

export interface TelemetrySample {
  time: string;
  runId: string;
  deviceId: string;
  deviceSerial?: string;
  channelId?: number;
  readings: TelemetryReadings;
  chamberSetpoint?: number;
  elapsedHours: number;
}

export interface AnomalyScores {
  pointScore: number;
  driftScore: number;
  sequenceScore: number;
  ensembleScore: number;
  severity: 'nominal' | 'info' | 'warning' | 'critical';
  anomalyClassGuess?: string;
  weights?: Record<string, number>;
}

export interface Disposition {
  id: string;
  deviceId: string;
  runId: string;
  decision: 'accept' | 'reject' | 'hold_fa';
  engineerId: string;
  engineerName?: string;
  comment?: string;
  decidedAt: string;
}

export interface Device {
  id: string;
  runId: string;
  deviceSerial: string;
  channelId: number;
  cohortBaselineJson?: Record<string, any>;
  createdAt: string;
  latestReadings?: TelemetryReadings;
  latestScores?: AnomalyScores;
  disposition?: Disposition;
}

export interface ShapFeature {
  feature: string;
  displayName: string;
  shapValue: number;
  percentage?: number;
  unit?: string;
  observedValue?: number;
  cohortBaseline?: number;
}

export interface ShapExplanation {
  summary: string;
  anomalyClass: string;
  topContributingFeatures: ShapFeature[];
  isExplainable: boolean;
}

export interface Alert {
  id: string;
  runId: string;
  deviceId: string;
  deviceSerial?: string;
  channelId?: number;
  score: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  explanation?: ShapExplanation;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export interface ModelMetrics {
  version: string;
  trainedAt: string;
  datasetSize: number;
  metrics: {
    precision: number;
    recall: number;
    f1Score: number;
    accuracy: number;
  };
  confusionMatrix: {
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    trueNegative: number;
  };
  classBreakdown: Array<{
    class: string;
    detected: number;
    total: number;
    recall: number;
  }>;
}
