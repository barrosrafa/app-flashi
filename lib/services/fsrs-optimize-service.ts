import { getFsrsOptimizationStatus, requestFsrsOptimization, type OptimizationStatus } from './optimizer-service';
export const fsrsOptimizeService = {
  start: requestFsrsOptimization,
  status: getFsrsOptimizationStatus,
};
export type FsrsStatus = OptimizationStatus;
