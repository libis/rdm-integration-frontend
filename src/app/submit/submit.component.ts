import { Component, OnInit } from '@angular/core';
import { DataUpdatesService } from '../data.updates.service';
import { DataStateService } from '../data.state.service';
import { SubmitService } from '../submit.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { Router } from '@angular/router';
import { StoreResult } from '../models/store-result';
import { interval, Subscription, switchMap } from 'rxjs';
import { CompareResult } from '../models/compare-result';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitComponent implements OnInit {

  data: Datafile[] = [];// this is a local state of the submit component; nice-to-have as it allows to see the progress of the submitted job
  dataSubscription?: Subscription;// monitors the progress of the job
  pid = "";

  // local state derived from this.data:
  created: Datafile[] = [];
  updated: Datafile[] = [];
  deleted: Datafile[] = [];

  disabled = false;
  submitted = false;

  constructor(
    private dataStateService: DataStateService,
    private dataUpdatesService: DataUpdatesService,
    private submitService: SubmitService,
    private router: Router) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.dataSubscription?.unsubscribe();
  }

  getDataSubscripion(): Subscription {
    return interval(5000)
      .pipe(
        switchMap(() => this.dataUpdatesService.updateData(this.data, this.pid))
      ).subscribe({
        next: (res: CompareResult) => {
          if (res.data !== undefined) {
            this.setData(res.data);
          }
          if (!this.hasUnfinishedDataFiles()) {
            this.dataSubscription?.unsubscribe();
          }
        },
        error: (err) => {
          alert("getting status of data failed: " + err.error);
          this.dataSubscription?.unsubscribe();
          this.router.navigate(['/connect']);
        },
      });
  }

  hasUnfinishedDataFiles(): boolean {
    return this.created.some((d) => d.status !== Filestatus.Equal) ||
      this.updated.some((d) => d.status !== Filestatus.Equal) ||
      this.deleted.some((d) => d.status !== Filestatus.Unknown);
  }

  loadData(): void {
    let value = this.dataStateService.getCurrentValue();
    this.pid = (value && value.id) ? value.id : "";
    let data = value?.data;
    if (data) {
      this.setData(data);
    }
  }

  setData(data: Datafile[]): void {
    this.data = data;
    this.created = this.toCreate();
    this.updated = this.toUpdate();
    this.deleted = this.toDelete();
    this.data = [...this.created, ...this.updated, ...this.deleted];
  }

  toCreate(): Datafile[] {
    let result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    })
    return result;
  }

  toUpdate(): Datafile[] {
    let result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    })
    return result;
  }

  toDelete(): Datafile[] {
    let result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Delete) {
        result.push(datafile);
      }
    })
    return result;
  }

  submit() {
    this.disabled = true;
    let selected: Datafile[] = [];
    this.data.forEach(datafile => {
      let action = datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) {
        selected.push(datafile)
      }
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }
    let httpSubscr = this.submitService.submit(selected).subscribe({
      next: (data: StoreResult) => {
        if (data.status !== "OK") {// this should not happen
          alert("store failed, status: " + data.status);
          this.router.navigate(['/connect']);
        } else {
          this.dataSubscription = this.getDataSubscripion();
          this.submitted = true;
        }
        httpSubscr.unsubscribe();
      },
      error: (err) => {
        alert("store failed: " + err.error);
        this.dataSubscription?.unsubscribe();
        this.router.navigate(['/connect']);
      },
    });
  }

}
