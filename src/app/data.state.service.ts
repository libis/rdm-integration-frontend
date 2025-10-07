// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { CachedResponse, CompareResult, Key } from './models/compare-result';
import { Credentials } from './models/credentials';
import { NotificationService } from './shared/notification.service';
import { UtilsService } from './utils.service';

@Injectable({
  providedIn: 'root',
})
export class DataStateService {
  private credentialsService = inject(CredentialsService);
  private dataService = inject(DataService);
  private router = inject(Router);
  private utils = inject(UtilsService);
  private notificationService = inject(NotificationService);

  private state: BehaviorSubject<CompareResult | null> =
    new BehaviorSubject<CompareResult | null>(null);

  constructor() {}

  initializeState(creds: Credentials): void {
    this.resetState();
    this.credentialsService.credentials = creds;
    this.dataService.getData().subscribe({
      next: (key) => this.getCompareData(key),
      error: (err) => {
        const is401 =
          err.status === 401 || (err.error && err.error.includes('401'));
        this.notificationService.showError(`Getting data failed: ${err.error}`);
        this.router.navigate(['/connect'], {
          queryParams: is401 ? { reset: 'true' } : {},
        });
      },
    });
  }

  private getCompareData(key: Key): void {
    this.dataService.getCachedData(key).subscribe({
      next: async (res: CachedResponse) => {
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
            this.notificationService.showError(res.err);
          }
        } else {
          await this.utils.sleep(1000);
          this.getCompareData(key);
        }
      },
      error: (err) => {
        const is401 =
          err.status === 401 || (err.error && err.error.includes('401'));
        this.notificationService.showError(`Comparing failed: ${err.error}`);
        this.router.navigate(['/connect'], {
          queryParams: is401 ? { reset: 'true' } : {},
        });
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
