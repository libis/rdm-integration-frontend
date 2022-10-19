import { Injectable } from '@angular/core';
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

  constructor(private credentialsService: CredentialsService, private dataService: DataService) { }

  initializeState(creds: Credentials): void {
    this.resetState();
    this.credentialsService.credentials = creds;
    let subscription = this.dataService.getData().subscribe(
      (key) => {
        if (key.key && key.key !== "") {
          this.getCompareData(key);
        } else {
          alert("internal server error: compare failed");
          this.state.next(null);
        }
        subscription.unsubscribe(); //should not be needed, http client calls complete()
      }
    );
  }

  private getCompareData(key: Key): void {
    let i = 0;
    let subscription = interval(1000)
      .pipe(
        switchMap(() => this.dataService.getCachedData(key))
      ).subscribe((res: CachedResponse) => {
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
