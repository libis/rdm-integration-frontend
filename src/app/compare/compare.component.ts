import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faArrowRight, faArrowRightArrowLeft, faAsterisk, faBolt, faCheckDouble, faCodeCompare, faEquals, faMinus, faNotEqual, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { interval, Observable, startWith, Subscription, switchMap } from 'rxjs';
import { DataService } from '../data.service';
import { CompareResult } from '../models/compare-result';
import { Credentials } from '../models/credentials';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {

  credentials: Observable<Credentials>;
  subscription: Subscription;
  creds: Credentials = {};
  data: CompareResult = {};
  dataSubscription: Subscription;

  icon_noaction = faSquare;
  icon_update = faArrowRight;
  icon_mirror = faArrowRightArrowLeft;

  icon_new = faPlus;
  icon_equal = faEquals;
  icon_updated = faNotEqual;
  icon_deleted = faMinus;
  icon_all = faAsterisk;

  icon_submit = faCheckDouble;

  icon_compare = faCodeCompare;
  icon_action = faBolt;

  constructor(
    public dataService: DataService,
    private router: Router,
    private store: Store<{ creds: Credentials }>
  ) {
    this.credentials = this.store.select('creds');
    this.subscription = this.credentials.subscribe(creds => this.creds = creds);
    this.dataSubscription = this.getDataSubscripion();
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.dataSubscription.unsubscribe();
    this.subscription.unsubscribe();
  }

  getDataSubscripion(): Subscription {
    return interval(1000)
      .pipe(
        startWith(0),
        switchMap(() => this.dataService.getData(this.creds))
      ).subscribe((res: CompareResult) => {
        console.log("getting data...");
        this.data = res;
        if (!this.hasDataFilesWithUnknownStatus()) {
          console.log("unsubscribing from data subscription...");
          this.dataSubscription.unsubscribe();
        }
      });
  }

  hasDataFilesWithUnknownStatus(): boolean {
    return this.data.data === undefined || this.data.data.some((d) => d.status === Filestatus.Unknown);
  }

  rowClass(datafile: Datafile): string {
    switch (datafile.action) {
      case Fileaction.Ignore:
        return '';
      case Fileaction.Copy:
        return 'table-success';
      case Fileaction.Update:
        return 'table-primary';
      case Fileaction.Delete:
        return 'table-danger';
    }
    return '';
  }

  noActionSelection(): void {
    this.data.data?.forEach(datafile => {
      if (datafile.hidden) {
        return;
      }
      datafile.action = Fileaction.Ignore
    });
  }

  updateSelection(): void {
    this.data.data?.forEach(datafile => {
      if (datafile.hidden) {
        return;
      }
      switch (datafile.status) {
        case Filestatus.New:
          datafile.action = Fileaction.Copy;
          break;
        case Filestatus.Equal:
          datafile.action = Fileaction.Ignore;
          break;
        case Filestatus.Updated:
          datafile.action = Fileaction.Update;
          break;
        case Filestatus.Deleted:
          datafile.action = Fileaction.Ignore;
          break;
      }
    });
  }

  mirrorSelection(): void {
    this.data.data?.forEach(datafile => {
      if (datafile.hidden) {
        return;
      }
      switch (datafile.status) {
        case Filestatus.New:
          datafile.action = Fileaction.Copy;
          break;
        case Filestatus.Equal:
          datafile.action = Fileaction.Ignore;
          break;
        case Filestatus.Updated:
          datafile.action = Fileaction.Update;
          break;
        case Filestatus.Deleted:
          datafile.action = Fileaction.Delete;
          break;
      }
    });
  }

  filterNew(): void {
    this.data.data?.forEach(datafile => {
      datafile.hidden = datafile.status !== Filestatus.New;
    });
  }

  filterEqual(): void {
    this.data.data?.forEach(datafile => {
      datafile.hidden = datafile.status !== Filestatus.Equal;
    });
  }

  filterUpdated(): void {
    this.data.data?.forEach(datafile => {
      datafile.hidden = datafile.status !== Filestatus.Updated;
    });
  }

  filterDeleted(): void {
    this.data.data?.forEach(datafile => {
      datafile.hidden = datafile.status !== Filestatus.Deleted;
    });
  }

  filterNone(): void {
    this.data.data?.forEach(datafile => {
      datafile.hidden = false;
    });
  }

  submit(): void {
    this.router.navigate(['/submit']);
  }

}
