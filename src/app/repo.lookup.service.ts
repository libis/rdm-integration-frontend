// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';
import { RepoLookupRequest } from './models/repo-lookup';
import { HierarchicalSelectItem } from './models/hierarchical-select-item';

@Injectable({
  providedIn: 'root',
})
export class RepoLookupService {
  private http = inject(HttpClient);

  url = 'api/plugin/options';
  search_url = 'api/plugin/search';

  constructor() {}

  getOptions(
    req: RepoLookupRequest,
  ): Observable<HierarchicalSelectItem<string>[]> {
    return this.http.post<HierarchicalSelectItem<string>[]>(this.url, req);
  }

  search(req: RepoLookupRequest): Observable<SelectItem<string>[]> {
    return this.http.post<SelectItem<string>[]>(this.search_url, req);
  }
}
