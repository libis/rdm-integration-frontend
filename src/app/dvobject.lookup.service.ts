// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class DvObjectLookupService {

  url = 'api/common/dvobjects';

  constructor(private http: HttpClient) { }

  getItems(collectionId: string, objectType: string, token: string): Observable<SelectItem<string>[]> {
    var req = {
      token: token,
      collectionId: collectionId,
      objectType: objectType,
    };

    return this.http.post<SelectItem<string>[]>(this.url, req);
  }
}
