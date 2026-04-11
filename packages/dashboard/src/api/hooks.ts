import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

type TimeRange = '5h' | '24h' | '7d' | '30d' | 'all';

interface DashboardStats {
  tokensToday: number;
  costToday: number;
  activeSessions: number;
  totalSessions: number;
}

interface TimeseriesPoint {
  bucket: string;
  model: string;
  totalTokens: number;
  costUsd: number;
}

interface CostTrendPoint {
  date: string;
  costUsd: number;
}

interface ModelMixEntry {
  model: string;
  totalTokens: number;
  costUsd: number;
  percentage: number;
}

interface SessionRow {
  sessionId: string;
  firstSeen: string;
  lastSeen: string;
  models: string[];
  totalTokens: number;
  costUsd: number;
  projectAlias: string;
}

interface ProjectRow {
  projectAlias: string;
  sessionCount: number;
  totalTokens: number;
  costUsd: number;
}

export function useDashboardStats(range: TimeRange) {
  return useQuery({
    queryKey: ['dashboard-stats', range],
    queryFn: () => apiGet<DashboardStats>('/api/v1/dashboard/stats', { range }),
    refetchInterval: 60_000,
  });
}

export function useTokenTimeseries(range: TimeRange) {
  return useQuery({
    queryKey: ['tokens-timeseries', range],
    queryFn: () => apiGet<TimeseriesPoint[]>('/api/v1/dashboard/tokens-timeseries', { range }),
    refetchInterval: 60_000,
  });
}

export function useCostTrend(range: TimeRange) {
  return useQuery({
    queryKey: ['cost-trend', range],
    queryFn: () => apiGet<CostTrendPoint[]>('/api/v1/dashboard/cost-trend', { range }),
    refetchInterval: 60_000,
  });
}

export function useModelMix(range: TimeRange) {
  return useQuery({
    queryKey: ['model-mix', range],
    queryFn: () => apiGet<ModelMixEntry[]>('/api/v1/dashboard/model-mix', { range }),
    refetchInterval: 60_000,
  });
}

interface SessionsResponse {
  sessions: SessionRow[];
  total: number;
}

export function useSessions(range: TimeRange, limit: number = 50, offset: number = 0) {
  return useQuery({
    queryKey: ['sessions', range, limit, offset],
    queryFn: () =>
      apiGet<SessionsResponse>('/api/v1/sessions', {
        range,
        limit: String(limit),
        offset: String(offset),
      }),
  });
}

interface SessionDetailRow {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  costUsd: number;
  entryCount: number;
}

export function useSessionDetail(sessionId: string | null) {
  return useQuery({
    queryKey: ['session-detail', sessionId],
    queryFn: () => apiGet<SessionDetailRow[]>(`/api/v1/sessions/${sessionId}/detail`),
    enabled: !!sessionId,
  });
}

interface CostBreakdownResponse {
  inputCost: number;
  outputCost: number;
  cacheWriteCost: number;
  cacheReadCost: number;
  totalCost: number;
}

export function useCostBreakdown(range: TimeRange) {
  return useQuery({
    queryKey: ['cost-breakdown', range],
    queryFn: () => apiGet<CostBreakdownResponse>('/api/v1/dashboard/cost-breakdown', { range }),
    refetchInterval: 60_000,
  });
}

export function useProjects(range: TimeRange) {
  return useQuery({
    queryKey: ['projects', range],
    queryFn: () => apiGet<ProjectRow[]>('/api/v1/projects', { range }),
  });
}

export function useProjectDetail(projectAlias: string | null, range: TimeRange) {
  return useQuery({
    queryKey: ['project-detail', projectAlias, range],
    queryFn: () => apiGet<SessionDetailRow[]>(`/api/v1/projects/${projectAlias}/detail`, { range }),
    enabled: !!projectAlias,
  });
}

interface HealthResponse {
  status: string;
  mode: string;
  entryCount: number;
  lastEntry: string | null;
  version: string;
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet<HealthResponse>('/api/v1/health'),
    refetchInterval: 60_000,
  });
}

export function useDeveloperStats(developerId: string, range: TimeRange) {
  return useQuery({
    queryKey: ['developer-stats', developerId, range],
    queryFn: () => apiGet<DashboardStats>(`/api/v1/admin/developer-stats/${developerId}`, { range }),
    enabled: !!developerId,
  });
}

export function useDeveloperTimeseries(developerId: string, range: TimeRange) {
  return useQuery({
    queryKey: ['developer-timeseries', developerId, range],
    queryFn: () => apiGet<TimeseriesPoint[]>(`/api/v1/admin/developer-timeseries/${developerId}`, { range }),
    enabled: !!developerId,
  });
}

interface AdminSettingsResponse {
  retentionDays: number;
  allowedDomain: string;
  mode: string;
  orgName?: string;
  orgId?: string;
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiGet<AdminSettingsResponse>('/api/v1/admin/settings'),
  });
}
