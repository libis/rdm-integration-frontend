// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { TokenResponse } from './models/oauth';

@Injectable({
  providedIn: 'root',
})
export class OauthService {
  private http = inject(HttpClient);

  token_url = 'api/common/oauthtoken';

  constructor() {}

  getToken(
    pluginId: string,
    code: string,
    nonce: string,
  ): Observable<TokenResponse> {
    const req = {
      pluginId: pluginId,
      code: code,
      nonce: nonce,
    };
    return this.http.post<TokenResponse>(this.token_url, req);
  }
}
