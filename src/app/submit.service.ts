// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { Datafile } from './models/datafile';
import { StoreResult } from './models/store-result';

export interface DownloadResponse {
  taskId: string;
  monitorUrl?: string;
}

export interface GlobusTaskStatus {
  task_id: string;
  status: string;
  nice_status?: string;
  bytes_transferred?: number;
  bytes_expected?: number;
  files?: number;
  files_transferred?: number;
  files_skipped?: number;
  files_failed?: number;
  completion_time?: string;
  request_time?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SubmitService {
  private http = inject(HttpClient);
  private credentialsService = inject(CredentialsService);

  store_url = 'api/common/store';
  download_url = 'api/common/download';

  constructor() {}

  submit(
    selected: Datafile[],
    sendEmailOnSuccess: boolean,
  ): Observable<StoreResult> {
    const credentials = this.credentialsService.credentials;
    const req = {
      plugin: credentials.plugin,
      streamParams: {
        pluginId: credentials.pluginId,
        repoName: credentials.repo_name,
        url: credentials.url,
        option: credentials.option,
        user: credentials.user,
        token: credentials.token,
      },
      persistentId: credentials.dataset_id,
      dataverseKey: credentials.dataverse_token,
      selectedNodes: selected,
      sendEmailOnSuccess: sendEmailOnSuccess,
    };

    return this.http.post<StoreResult>(this.store_url, req);
  }

  download(
    selected: Datafile[],
    endpoint: string | undefined,
    option: string | undefined,
    globusToken: string | undefined,
    pid: string | undefined,
    dvToken: string | undefined,
    downloadId: string | undefined,
  ): Observable<DownloadResponse> {
    const req = {
      plugin: 'globus',
      streamParams: {
        pluginId: 'globus',
        repoName: endpoint,
        option: option,
        token: globusToken,
        downloadId: downloadId,
      },
      persistentId: pid,
      dataverseKey: dvToken,
      selectedNodes: selected,
    };
    return this.http.post<DownloadResponse>(this.download_url, req);
  }

  getGlobusTransferStatus(taskId: string): Observable<GlobusTaskStatus> {
    return this.http.get<GlobusTaskStatus>('api/common/globus/status', {
      params: { taskId },
    });
  }
}
