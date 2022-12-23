import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SelectItem } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class DoiLookupService {

  url = 'api/common/datasets';

  constructor(private http: HttpClient) { }

  getItems(token: string): Observable<SelectItem<string>[]> {
    var req = {
      token: token,
    };

    return this.http.post<SelectItem<string>[]>(this.url, req);
  }
}
