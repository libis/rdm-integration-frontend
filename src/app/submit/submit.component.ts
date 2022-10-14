import { Component, OnInit } from '@angular/core';
import { DataUpdatesService } from '../data.updates.service';
import { DataStateService } from '../data.state.service';
import { SubmitService } from '../submit.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { Router } from '@angular/router';
import { StoreResult } from '../models/store-result';
import { interval, Subscription, switchMap } from 'rxjs';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
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

  icon_check = faCheck;

  disabled = false;

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
      ).subscribe((res: CompareResult) => {
        if (res.data !== undefined) {
          this.setData(res.data);
        }
        if (!this.hasUnfinishedDataFiles()) {
          this.dataSubscription?.unsubscribe();
        }
      });
  }

  hasUnfinishedDataFiles(): boolean {
    this.data.forEach((d) => console.log(d.status));
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

  renderFile(datafile: Datafile, isDelete: boolean): string {
    let res = `${datafile.path ? datafile.path + '/' : ''}${datafile.name}`;
    if ((isDelete && datafile.status === Filestatus.Unknown) || (!isDelete && datafile.status === Filestatus.Equal)) {
        res += this.icon_check;
    }
    return res;
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
    let httpSubscr = this.submitService.submit(selected).subscribe((data: StoreResult) => {
      if (data.status !== "OK") {
        console.error("store failed: " + data.status);
      } else {
        this.dataSubscription = this.getDataSubscripion();
      }
      httpSubscr.unsubscribe(); //should not be needed, http client calls complete()
    });
  }

}
