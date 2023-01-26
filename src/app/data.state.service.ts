// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, interval, Observable, switchMap } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { CachedResponse, CompareResult, Key, ResultStatus } from './models/compare-result';
import { Credentials } from './models/credentials';

@Injectable({
  providedIn: 'root'
})
export class DataStateService {

  private state: BehaviorSubject<CompareResult | null> = new BehaviorSubject<CompareResult | null>(null);

  constructor(
    private credentialsService: CredentialsService,
    private dataService: DataService,
    private router: Router,
  ) { }

  initializeState(creds: Credentials): void {
    this.resetState();
    this.credentialsService.credentials = creds;
    let subscription = this.dataService.getData().subscribe({
      next: (key) => {
        this.getCompareData(key);
        subscription.unsubscribe();
      },
      error: (err) => {
        alert("getting data failed: " + err.error);
        subscription.unsubscribe();
        this.router.navigate(['/connect']);
      }
    });
  }

  private getCompareData(key: Key): void {
    let i = 0;
    let subscription = interval(1000)
      .pipe(
        switchMap(() => this.dataService.getCachedData(key))
      ).subscribe({
        next: (res: CachedResponse) => {
        i++;
        if (res.ready === true) {
          if (res.res) {
            res.res.data = res.res.data?.sort((o1, o2) => (o1.id === undefined ? "" : o1.id) < (o2.id === undefined ? "" : o2.id) ? -1 : 1);
            this.state.next(res.res);
          } else {
            this.state.next(null);
          }
          if (res.err && res.err !== "") {
            alert(res.err);
          }
          subscription.unsubscribe();
        } else if (i > 1000) {
          alert("compare failed: time out");
          subscription.unsubscribe();
          this.router.navigate(['/connect']);
        }
      },
      error: (err) => {
        alert("comparing failed: " + err.error);
        subscription.unsubscribe();
        this.router.navigate(['/connect']);
      }
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
