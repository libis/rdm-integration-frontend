import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { Datafile, Fileaction } from '../models/datafile';
import { Router } from '@angular/router';
import { StoreResult } from '../models/store-result';
import { CompareResult } from '../models/compare-result';
import { Observable, Subscription } from 'rxjs';
import { Credentials } from '../models/credentials';
import { Store } from '@ngrx/store';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitComponent implements OnInit {

  data: CompareResult = {};
  credentials: Observable<Credentials>;
  subscription: Subscription;
  creds: Credentials = {};

  constructor(
    private dataService: DataService,
    private router: Router,
    private store: Store<{ creds: Credentials}>) {
      this.credentials = this.store.select('creds');
      this.subscription = this.credentials.subscribe(creds => this.creds = creds);
    }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadData(): void {
    this.data = this.dataService.compare_result;
  }

  created() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    })
    return result;
  }

  updated() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    })
    return result;
  }

  deleted() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Delete) {
        result.push(datafile);
      }
    })
    return result;
  }

  submit() {
    let selected: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      let action = datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) {
        selected.push(datafile)
      }
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }
    let httpSubscr = this.dataService.submit(this.creds, selected).subscribe((data: StoreResult) => {
      if (data.status !== "OK") {
        console.error("store failed: " + data.status);
      }
      httpSubscr.unsubscribe(); //should not be needed, http client calls complete()
      this.router.navigate(['/connect']); //TODO: status page
    });
  }

}
