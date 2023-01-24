import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { Datafile } from './models/datafile';
import { CompareResult } from './models/compare-result';

@Injectable({
    providedIn: 'root'
})
export class DataUpdatesService {

    common_compare_url = 'api/common/compare';

    constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

    updateData(data: Datafile[], pid: string): Observable<CompareResult> {
        var req = {
            data: data,
            persistentId: pid,
            dataverseKey: this.credentialsService.credentials.dataverse_token,
        };

        return this.http.post<CompareResult>(this.common_compare_url, req).pipe(
            map((res: CompareResult) => {
                res.data = res.data?.sort((o1, o2) => (o1.id === undefined ? "" : o1.id) < (o2.id === undefined ? "" : o2.id) ? -1 : 1);
                return res;
            }));
    }

}
