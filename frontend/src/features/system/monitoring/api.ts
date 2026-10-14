import {get, mutate} from '../shared/http';
import type {HealthSummary, HealthTimeseries} from './types';

export const monitoringApi = {
  summary: () => get<HealthSummary>('/website/system/monitoring/summary'),
  timeseries: (hours = 24) =>
    get<HealthTimeseries>(`/website/system/monitoring/timeseries?hours=${hours}`),
  run: () => mutate<HealthSummary>('/website/system/monitoring/checks/run', 'POST'),
};
