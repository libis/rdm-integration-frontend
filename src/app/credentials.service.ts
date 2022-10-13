import { Injectable } from '@angular/core';
import { Credentials } from './models/credentials';

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {

    credentials: Credentials = {};
    
}
