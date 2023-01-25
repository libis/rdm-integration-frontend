// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class BranchLookupService {

  url = 'api/plugin/options';

  constructor(private http: HttpClient) { }

  getItems(req: any): Observable<SelectItem<string>[]> {
    return this.http.post<SelectItem<string>[]>(this.url, req);
  }
}
