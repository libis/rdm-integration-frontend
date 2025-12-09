// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class DvObjectLookupService {
  private http = inject(HttpClient);

  url = 'api/common/dvobjects';

  constructor() {}

  getItems(
    collectionId: string,
    objectType: string,
    searchTerm?: string,
    token?: string,
    forDownload?: boolean,
  ): Observable<SelectItem<string>[]> {
    const req = {
      token: token,
      collectionId: collectionId,
      objectType: objectType,
      searchTerm: searchTerm,
      forDownload: forDownload ?? false,
    };

    return this.http.post<SelectItem<string>[]>(this.url, req);
  }
}
