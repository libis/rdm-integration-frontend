// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { StoreResult } from './models/store-result';
import { HttpClient } from '@angular/common/http';
import { Datafile } from './models/datafile';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class SubmitService {

  store_url = 'api/common/store';
  download_url = "api/common/download";

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  submit(selected: Datafile[], sendEmailOnSuccess: boolean): Observable<StoreResult> {
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

  download(selected: Datafile[], endpoint: string | undefined, option: string | undefined, globusToken: string | undefined, pid: string | undefined, dvToken: string | undefined): Observable<string> {
    const credentials = this.credentialsService.credentials;
    const req = {
      plugin: 'globus',
      streamParams: {
        pluginId: "globus",
        repoName: endpoint,
        option: option,
        token: globusToken,
      },
      persistentId: pid,
      dataverseKey: dvToken,
      selectedNodes: selected,
    };
    return this.http.post<string>(this.download_url, req);
  }
}
