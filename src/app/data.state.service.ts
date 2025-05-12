// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { CachedResponse, CompareResult, Key } from './models/compare-result';
import { Credentials } from './models/credentials';
import { UtilsService } from './utils.service';

@Injectable({
  providedIn: 'root',
})
export class DataStateService {
  private state: BehaviorSubject<CompareResult | null> =
    new BehaviorSubject<CompareResult | null>(null);

  constructor(
    private credentialsService: CredentialsService,
    private dataService: DataService,
    private router: Router,
    private utils: UtilsService,
  ) {}

  initializeState(creds: Credentials): void {
    this.resetState();
    this.credentialsService.credentials = creds;
    const subscription = this.dataService.getData().subscribe({
      next: (key) => {
        subscription.unsubscribe();
        this.getCompareData(key);
      },
      error: (err) => {
        subscription.unsubscribe();
        alert('getting data failed: ' + err.error);
        this.router.navigate(['/connect']);
      },
    });
  }

  private getCompareData(key: Key): void {
    const subscription = this.dataService.getCachedData(key).subscribe({
      next: async (res: CachedResponse) => {
        subscription.unsubscribe();
        if (res.ready === true) {
          if (res.res) {
            res.res.data = res.res.data?.sort((o1, o2) =>
              (o1.id === undefined ? '' : o1.id) <
              (o2.id === undefined ? '' : o2.id)
                ? -1
                : 1,
            );
            this.state.next(res.res);
          } else {
            this.state.next(null);
          }
          if (res.err && res.err !== '') {
            alert(res.err);
          }
        } else {
          await this.utils.sleep(1000);
          this.getCompareData(key);
        }
      },
      error: (err) => {
        subscription.unsubscribe();
        alert('comparing failed: ' + err.error);
        this.router.navigate(['/connect']);
      },
    });
  }

  getObservableState(): Observable<CompareResult | null> {
    return this.state.asObservable();
  }

  updateState(state: CompareResult): void {
    this.state.next(state);
  }

  getCurrentValue(): CompareResult | null {
    return this.state.getValue();
  }

  resetState(): void {
    this.state.next(null);
  }
}
