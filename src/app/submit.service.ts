// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { Datafile } from './models/datafile';
import { StoreResult } from './models/store-result';

interface DownloadResponse {
  taskId: string;
  monitorUrl?: string;
}

export interface TransferTaskStatus {
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
    const req = {
      plugin: this.credentialsService.plugin$(),
      streamParams: {
        pluginId: this.credentialsService.pluginId$(),
        repoName: this.credentialsService.repoName$(),
        url: this.credentialsService.url$(),
        option: this.credentialsService.option$(),
        user: this.credentialsService.user$(),
        token: this.credentialsService.token$(),
      },
      persistentId: this.credentialsService.datasetId$(),
      dataverseKey: this.credentialsService.dataverseToken$(),
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

  getGlobusTransferStatus(
    taskId: string,
    oauthSessionId?: string,
  ): Observable<TransferTaskStatus> {
    const params: { [key: string]: string } = { taskId };
    if (oauthSessionId) {
      params['oauthSessionId'] = oauthSessionId;
    }
    return this.http.get<TransferTaskStatus>('api/common/globus/status', {
      params,
    });
  }
}
