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

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  submit(selected: Datafile[]): Observable<StoreResult> {
    let credentials = this.credentialsService.credentials;
    var req;
    switch (credentials.repo_type) {
      case "github":
        req = {
          streamType: "github",
          streamParams: {
            token: credentials.repo_token,
            user: credentials.repo_owner,
            repo: credentials.repo_name,
          },
          persistentId: credentials.dataset_id,
          dataverseKey: credentials.dataverse_token,
          selectedNodes: selected,
        };
        break;

        case "gitlab":
          req = {
            streamType: "gitlab",
            streamParams: {
              base: credentials.base,
              token: credentials.repo_token,
              group: credentials.repo_owner,
              project: credentials.repo_name,
            },
            persistentId: credentials.dataset_id,
            dataverseKey: credentials.dataverse_token,
            selectedNodes: selected,
          };
          break;

          case "irods":
            req = {
              streamType: "irods",
              streamParams: {
                server: credentials.base,
                password: credentials.repo_token,
                user: credentials.repo_owner,
                zone: credentials.repo_name,
                folder: credentials.repo_branch,
              },
              persistentId: credentials.dataset_id,
              dataverseKey: credentials.dataverse_token,
              selectedNodes: selected,
            };
            break;

      default:
        break;
    }

    return this.http.post<StoreResult>(this.store_url, req);
  }
}
