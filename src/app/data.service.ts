// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, inject } from '@angular/core';
import {
  AccessResponse,
  AddFileRequest,
  CachedComputeResponse,
  CachedResponse,
  CompareResult,
  ComputeRequest,
  DdiCdiOutputCache,
  DdiCdiRequest,
  GlobusDownloadParams,
  Key,
} from './models/compare-result';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);

  compare_url = 'api/plugin/compare';
  common_get_cached_data_url = 'api/common/cached';
  common_get_executable_files_url = 'api/common/executable';
  common_get_check_access_files_url = 'api/common/checkaccess';
  common_compute_url = 'api/common/compute';
  common_get_cached_compute_res_url = 'api/common/cachedcompute';
  common_ddicdi_url = 'api/common/ddicdi';
  common_get_cached_ddicdi_res_url = 'api/common/cachedddicdi';
  common_get_cached_ddicdi_output_url = 'api/common/cachedddicdioutput';
  common_get_ddicdi_compatible_files_url = 'api/common/ddicdicompatible';
  common_add_file_url = 'api/common/addfile';
  common_get_downloadable_files_url = 'api/common/downloadable';
  frontend_get_shacl_url = 'api/frontend/shacl';

  constructor() {}

  getData(): Observable<Key> {
    const credentials = this.credentialsService.credentials;
    const req = {
      pluginId: credentials.pluginId,
      plugin: credentials.plugin,
      repoName: credentials.repo_name,
      url: credentials.url,
      option: credentials.option,
      user: credentials.user,
      token: credentials.token,
      persistentId: credentials.dataset_id,
      newlyCreated: credentials.newly_created,
      dataverseKey: credentials.dataverse_token,
    };

    return this.http.post<Key>(this.compare_url, req);
  }

  getCachedData(key: Key): Observable<CachedResponse> {
    return this.http.post<CachedResponse>(this.common_get_cached_data_url, key);
  }

  getExecutableFiles(
    pid: string,
    dataverse_token?: string,
  ): Observable<CompareResult> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
    };
    return this.http.post<CompareResult>(
      this.common_get_executable_files_url,
      req,
    );
  }

  checkAccessToQueue(
    pid?: string,
    dataverse_token?: string,
    queue?: string,
  ): Observable<AccessResponse> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
      queue: queue,
    };
    return this.http.post<AccessResponse>(
      this.common_get_check_access_files_url,
      req,
    );
  }

  compute(req: ComputeRequest): Observable<Key> {
    return this.http.post<Key>(this.common_compute_url, req);
  }

  getCachedComputeData(key: Key): Observable<CachedComputeResponse> {
    return this.http.post<CachedComputeResponse>(
      this.common_get_cached_compute_res_url,
      key,
    );
  }

  getDownloadableFiles(
    pid: string,
    dataverse_token?: string,
  ): Observable<CompareResult> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
    };
    return this.http.post<CompareResult>(
      this.common_get_downloadable_files_url,
      req,
    );
  }

  generateDdiCdi(req: DdiCdiRequest): Observable<Key> {
    return this.http.post<Key>(this.common_ddicdi_url, req);
  }

  getCachedDdiCdiData(key: Key): Observable<CachedComputeResponse> {
    return this.http.post<CachedComputeResponse>(
      this.common_get_cached_ddicdi_res_url,
      key,
    );
  }

  getDdiCdiCompatibleFiles(
    pid: string,
    dataverse_token?: string,
  ): Observable<CompareResult> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
    };
    return this.http.post<CompareResult>(
      this.common_get_ddicdi_compatible_files_url,
      req,
    );
  }

  getCachedDdiCdiOutput(persistentId: string): Observable<DdiCdiOutputCache> {
    return this.http.post<DdiCdiOutputCache>(
      this.common_get_cached_ddicdi_output_url,
      { persistentId },
    );
  }

  addFileToDataset(req: AddFileRequest): Observable<Key> {
    return this.http.post<Key>(this.common_add_file_url, req);
  }

  getShaclTemplate(): Observable<string> {
    return this.http.get(this.frontend_get_shacl_url, {
      responseType: 'text',
    });
  }

  getUserInfo(): Observable<{ loggedIn: boolean }> {
    return this.http.get<{ loggedIn: boolean }>('api/common/userinfo');
  }

  /**
   * Call Dataverse globusDownloadParameters API to get dataset info from downloadId.
   * Uses the preview URL token as API key if provided.
   */
  getGlobusDownloadParams(
    dataverseUrl: string,
    datasetDbId: string,
    downloadId: string,
    previewToken?: string,
  ): Observable<GlobusDownloadParams> {
    const url = `${dataverseUrl}/api/datasets/${datasetDbId}/globusDownloadParameters?downloadId=${downloadId}`;
    const headers: Record<string, string> = {};
    if (previewToken) {
      headers['X-Dataverse-key'] = previewToken;
    }
    return this.http.get<GlobusDownloadParams>(url, { headers });
  }
}
