// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { AccessResponse, CachedComputeResponse, CachedResponse, CompareResult, ComputeRequest, Key } from './models/compare-result';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  compare_url = 'api/plugin/compare';
  common_get_cached_data_url = 'api/common/cached';
  common_get_executable_files_url = "api/common/executable";
  common_get_check_access_files_url = "api/common/checkaccess";
  common_compute_url = "api/common/compute";
  common_get_cached_compute_res_url = "api/common/cachedcompute";
  common_get_downloadable_files_url = "api/common/downloadable";
  common_download_url = "api/common/download";
  common_get_cached_download_res_url = "api/common/cacheddownload";

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

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

  getExecutableFiles(pid: string, dataverse_token?: string): Observable<CompareResult> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
    };
    return this.http.post<CompareResult>(this.common_get_executable_files_url, req);
  }

  checkAccessToQueue(pid?: string, dataverse_token?: string, queue?: string): Observable<AccessResponse> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
      queue: queue,
    };
    return this.http.post<AccessResponse>(this.common_get_check_access_files_url, req);
  }

  compute(req: ComputeRequest): Observable<Key> {
    return this.http.post<Key>(this.common_compute_url, req);
  }

  getCachedComputeData(key: Key): Observable<CachedComputeResponse> {
    return this.http.post<CachedComputeResponse>(this.common_get_cached_compute_res_url, key);
  }

  getDownloadableFiles(pid: string, dataverse_token?: string): Observable<CompareResult> {
    const req = {
      persistentId: pid,
      dataverseKey: dataverse_token,
    };
    return this.http.post<CompareResult>(this.common_get_downloadable_files_url, req);
  }

  download(): Observable<Key> {
    return this.http.get<Key>(this.common_download_url);
  }
}
