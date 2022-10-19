import { Component, Input, OnInit } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faCopy, faClone, faTrash, faQuestion } from '@fortawesome/free-solid-svg-icons';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'tr[app-datafile]',
  templateUrl: './datafile.component.html',
  styleUrls: ['./datafile.component.scss']
})
export class DatafileComponent implements OnInit {

  @Input() datafile: Datafile = {};
  @Input("loading") loading: boolean = true;

  icon_unknown = faQuestion;

  icon_new = "pi pi-plus-circle";
  icon_deleted = "pi pi-minus-circle";
  icon_equal = "pi pi-check-circle";
  icon_not_equal = "pi pi-exclamation-circle";
  icon_spinner = "pi pi-spin pi-spinner"
  icon_refresh = "pi pi-refresh"

  icon_ignore = faSquare;
  icon_copy = faCopy;
  icon_update = faClone;
  icon_delete = faTrash;

  constructor() { }

  ngOnInit(): void {
  }

  sourceFile(): string {
    if (this.datafile.status == Filestatus.Deleted) {
      return '';
    }
    return `${this.datafile.path ? this.datafile.path + '/' : ''}${this.datafile.name}`
  }

  comparison(): string {
    switch (Number(this.datafile.status)) {
      case Filestatus.New:
        return this.icon_new;
      case Filestatus.Equal:
        return this.icon_equal;
      case Filestatus.Updated:
        return this.icon_not_equal;
      case Filestatus.Deleted:
        return this.icon_deleted;
    }
    if (this.loading) {
      return this.icon_spinner;
    }
    return this.icon_refresh;
  }

  action(): IconDefinition {
    switch (Number(this.datafile.action)) {
      case Fileaction.Ignore:
        return this.icon_ignore;
      case Fileaction.Copy:
        return this.icon_copy;
      case Fileaction.Delete:
        return this.icon_delete;
      case Fileaction.Update:
        return this.icon_update;
    }
    return this.icon_unknown;
  }

  targetFile(): string {
    if (this.datafile.status === Filestatus.New && this.datafile.action !== Fileaction.Copy) {
      return '';
    }
    return `${this.datafile.path ? this.datafile.path + '/' : ''}${this.datafile.name}`
  }

  toggleAction(): void {
    switch (this.datafile.status) {
      case Filestatus.New:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.datafile.action = Fileaction.Copy;
            break;
          case Fileaction.Copy:
            this.datafile.action = Fileaction.Ignore;
            break;
        }
        break;
      case Filestatus.Equal:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.datafile.action = Fileaction.Update;
            break;
          case Fileaction.Update:
            this.datafile.action = Fileaction.Delete;
            break;
          case Fileaction.Delete:
            this.datafile.action = Fileaction.Ignore;
            break;
        }
        break;
      case Filestatus.Updated:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.datafile.action = Fileaction.Update;
            break;
          case Fileaction.Update:
            this.datafile.action = Fileaction.Delete;
            break;
          case Fileaction.Delete:
            this.datafile.action = Fileaction.Ignore;
            break;
        }
        break;
      case Filestatus.Deleted:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.datafile.action = Fileaction.Delete;
            break;
          case Fileaction.Delete:
            this.datafile.action = Fileaction.Ignore;
            break;
        }
        break;
    }
  }

  targetFileClass(): string {
    switch (this.datafile.action) {
      case Fileaction.Delete:
        return "text-decoration-line-through";
      case Fileaction.Copy:
        return "fst-italic fw-bold";
      case Fileaction.Update:
        return "fw-bold";
      case Fileaction.Ignore:
        return "text-muted";
      }
    return '';
  }

}
