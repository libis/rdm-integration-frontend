import { Component, Input, OnInit } from '@angular/core';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'tr[app-submitted-file]',
  templateUrl: './submitted-file.component.html',
  styleUrls: ['./submitted-file.component.scss']
})
export class SubmittedFileComponent implements OnInit {

  @Input() datafile: Datafile = {};
  @Input('isSubmitted') isSubmitted: boolean = false;

  constructor() { }

  ngOnInit(): void {
  }

  file(): string {
    return `${this.datafile.path ? this.datafile.path + '/' : ''}${this.datafile.name}`
  }

  iconClass(): string {
    if (this.isReady()) {
      return "pi pi-check";
    }
    return "pi pi-spin pi-spinner";
  }

  isReady(): boolean {
    let isDelete = this.datafile.action === Fileaction.Delete;
    return (isDelete && this.datafile.status === Filestatus.Unknown) || (!isDelete && this.datafile.status === Filestatus.Equal);
  }

}
