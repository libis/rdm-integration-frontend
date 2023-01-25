// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { Credentials } from './models/credentials';

@Injectable({
  providedIn: 'root'
})
export class CredentialsService {

    credentials: Credentials = {};
    
}
