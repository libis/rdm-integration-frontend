import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faArrowRight, faArrowRightArrowLeft, faAsterisk, faBolt, faCheckDouble, faCodeCompare, faEquals, faMinus, faNotEqual, faPlus } from '@fortawesome/free-solid-svg-icons';
import { Store } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';
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
  obs: Observable<CompareResult>|null = null;
  data: CompareResult = {};

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
    private store: Store<{ creds: Credentials}>
  ) {
    this.credentials = this.store.select('creds');
    this.subscription = this.credentials.subscribe(creds => this.creds = creds);
  }

  ngOnInit(): void {
    this.getData();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  getData(): void {
    this.obs = this.dataService.getData(this.creds);
  }

  sort(toSort: CompareResult | null): Datafile[] {
    if (toSort === null) {
      return [];
    }
    toSort.data = toSort.data?.sort((o1, o2) => (o1.id === undefined ? "" : o1.id) < (o2.id === undefined ? "" : o2.id) ? -1 : 1);
    this.data = toSort;
    this.dataService.compare_result = toSort;
    return this.data.data == undefined ? [] : this.data.data;
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
      datafile.action= Fileaction.Ignore
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
