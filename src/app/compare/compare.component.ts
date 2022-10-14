import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faArrowRight, faArrowRightArrowLeft, faAsterisk, faBolt, faCheckDouble, faCodeCompare, faEquals, faMinus, faNotEqual, faPlus } from '@fortawesome/free-solid-svg-icons';
import { interval, Subscription, switchMap } from 'rxjs';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {

  data: CompareResult = {};
  updatedDataSubscription?: Subscription;

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

  disabled = true;

  constructor(
    public dataUpdatesService: DataUpdatesService,
    public dataStateService: DataStateService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.setUpdatedDataSubscription();
  }

  ngOnDestroy(): void {
    this.updatedDataSubscription?.unsubscribe();
  }

  setUpdatedDataSubscription() {
    let initialStateSubscription = this.dataStateService.getObservableState().subscribe((data) => {
      if (data !== null) {
        initialStateSubscription.unsubscribe();
        this.data = data;
        if (data.data && data.id) {
          if (this.data.status !== ResultStatus.Updating) {
            this.disabled = false;
          } else {
            this.updatedDataSubscription = this.getUpdatedDataSubscription();
          }
        }
      }
    });
  }

  getUpdatedDataSubscription(): Subscription {
    return interval(5000).pipe(
      switchMap(() => this.dataUpdatesService.updateData(this.data.data!, this.data.id!))
    ).subscribe((data: CompareResult) => {
      if (data.data && data.id) {
        this.data = data;
      }
      if (this.data.status !== ResultStatus.Updating) {
        this.updatedDataSubscription?.unsubscribe();
        this.disabled = false;
      }
    });
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
    console.log("updating state...");
    this.dataStateService.updateState(this.data);
    this.router.navigate(['/submit']);
  }

}
