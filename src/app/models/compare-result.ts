// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Datafile } from './datafile';

export enum ResultStatus {
  New = 0,
  Updating = 1,
  Finished = 2,
}

export interface CompareResult {
  id?: string;
  status?: ResultStatus;
  data?: Datafile[];
  url?: string;
  maxFileSize?: number;
  rejectedSize?: string[];
  rejectedName?: string[];
  allowedFileNamePattern?: string;
  allowedFolderPathPattern?: string;
  preSelectedIds?: number[];
}

export interface CachedResponse {
  key?: string;
  ready?: boolean;
  res?: CompareResult;
  err?: string;
}

export interface Key {
  key?: string;
}

export interface AddFileResponse {
  fileId: number;
  key: string;
}

export interface AccessResponse {
  access: boolean;
  message: string;
}

export interface ComputeRequest {
  persistentId: string;
  dataverseKey?: string;
  queue: string;
  executable: string;
  sendEmailOnSuccess: boolean;
}

export interface CachedComputeResponse {
  key?: string;
  ready?: boolean;
  res?: string;
  ddiCdi?: string;
  err?: string;
}

export interface DdiCdiRequest {
  persistentId: string;
  dataverseKey?: string;
  queue: string;
  fileNames: string[];
  sendEmailOnSuccess: boolean;
}

export interface AddFileRequest {
  persistentId: string;
  dataverseKey?: string;
  fileName: string;
  content: string;
}

export interface DdiCdiOutputCache {
  ddiCdi: string;
  consoleOut: string;
  errorMessage: string;
  timestamp: string;
}

/**
 * Response from Dataverse globusDownloadParameters API
 */
export interface GlobusDownloadParams {
  status: string;
  data: {
    queryParameters: {
      datasetId: number;
      siteUrl: string;
      datasetVersion: string;
      dvLocale: string;
      datasetPid: string;
      managed: string;
      endpoint: string;
      files: Record<string, string>;
    };
    signedUrls: Array<{
      name: string;
      httpMethod: string;
      signedUrl: string;
      timeOut: number;
    }>;
  };
}
