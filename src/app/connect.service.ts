import { Injectable } from '@angular/core';
import { Credentials } from './models/credentials';

@Injectable({
  providedIn: 'root'
})
export class ConnectService {

  credentials: Credentials = {};


  login(credentials: Credentials): string {
    this.credentials = credentials;
    if (credentials.dataset_id !== undefined) {
      return credentials.dataset_id;
    }
    return 'unknown-dataset';
  }

}
