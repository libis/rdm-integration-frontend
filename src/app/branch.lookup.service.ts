import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class BranchLookupService {

  url = 'api/common/branches';

  constructor(private http: HttpClient) { }

  getItems(repoTpe: string, token: string): Observable<SelectItem<string>[]> {
    var req = {
      repoTpe: repoTpe,
      token: token,
    };

    return this.http.post<SelectItem<string>[]>(this.url, req);
  }
}
