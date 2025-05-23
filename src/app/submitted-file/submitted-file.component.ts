// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, input } from '@angular/core';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

@Component({
  selector: 'tr[app-submitted-file]',
  templateUrl: './submitted-file.component.html',
  styleUrls: ['./submitted-file.component.scss'],
})
export class SubmittedFileComponent implements OnInit {
  readonly datafile = input<Datafile>({});
  readonly isSubmitted = input(false);

  constructor() {
    // empty
  }

  ngOnInit(): void {
    // empty
  }

  file(): string {
    const datafile = this.datafile();
    return `${datafile.path ? datafile.path + '/' : ''}${this.datafile().name}`;
  }

  iconClass(): string {
    if (this.isReady()) {
      return 'pi pi-check';
    }
    return 'pi pi-spin pi-spinner';
  }

  isReady(): boolean {
    const isDelete = this.datafile().action === Fileaction.Delete;
    const datafile = this.datafile();
    return (
      (isDelete && datafile.status === Filestatus.New) ||
      (!isDelete && datafile.status === Filestatus.Equal)
    );
  }
}
