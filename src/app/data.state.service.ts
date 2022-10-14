import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { CompareResult, ResultStatus } from './models/compare-result';
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
      (data) => {
        this.state.next(data);
        subscription.unsubscribe(); //should not be needed, http client calls complete()
      }
    );
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
