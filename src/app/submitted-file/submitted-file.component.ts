import { Component, Input, OnInit } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'app-submitted-file',
  templateUrl: './submitted-file.component.html',
  styleUrls: ['./submitted-file.component.scss']
})
export class SubmittedFileComponent implements OnInit {

  @Input() datafile: Datafile = {};
  @Input('isSubmitted') isSubmitted: boolean = false;

  icon_check = faCheck;
  icon_in_progress = faSpinner;

  constructor() { }

  ngOnInit(): void {
  }

  file(): string {
    return `${this.datafile.path ? this.datafile.path + '/' : ''}${this.datafile.name}`
  }

  icon(): IconDefinition {
    if (this.isReady()) {
      return this.icon_check;
    }
    return this.icon_in_progress;
  }

  isReady(): boolean {
    let isDelete = this.datafile.action === Fileaction.Delete;
    return (isDelete && this.datafile.status === Filestatus.Unknown) || (!isDelete && this.datafile.status === Filestatus.Equal);
  }

}
