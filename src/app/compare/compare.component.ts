import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faArrowRight, faArrowRightArrowLeft, faAsterisk, faBolt, faCheckDouble, faCodeCompare, faEquals, faMinus, faNotEqual, faPlus } from '@fortawesome/free-solid-svg-icons';
import { DataService } from '../data.service';
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {

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
    private route: ActivatedRoute,
    private dataService: DataService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.getData();
  }

  getData(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.data = this.dataService.getData(id);
    }
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
