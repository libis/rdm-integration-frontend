import { Injectable } from '@angular/core';
import { CompareResult, ResultStatus } from './models/compare-result';
import { Credentials } from './models/credentials';
import { Datafile, Fileaction, Filestatus } from './models/datafile';
import { concatMap, delay, from, interval, Observable, of, Subscriber } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConnectService {

  credentials: Credentials = {
    repo_owner: '',
    repo_name: '',
    repo_type: '',
    repo_branch: '',
    repo_token: '',
    dataset_id: '',
    dataverse_token: ''
  };


  login(credentials: Credentials): string {
    return '12345678';
  }

}
