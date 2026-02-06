// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import {
  FileActionStyle,
  buildInlineStyle,
  getFileActionStyle,
} from '../shared/constants';
import { CredentialsService } from '../credentials.service';

@Component({
  selector: 'tr[app-submitted-file]',
  templateUrl: './submitted-file.component.html',
  styleUrls: ['./submitted-file.component.scss'],
  exportAs: 'appSubmittedFile',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmittedFileComponent {
  private readonly credentialsService = inject(CredentialsService);
  readonly datafile = input<Datafile>({});
  readonly isSubmitted = input(false);

  readonly fileName = computed(() => {
    const datafile = this.datafile();
    return `${datafile.path ? `${datafile.path}/` : ''}${datafile.name}`;
  });

  readonly isReady = computed(() => {
    const isDelete = this.datafile().action === Fileaction.Delete;
    const datafile = this.datafile();
    return (
      (isDelete && datafile.status === Filestatus.New) ||
      (!isDelete && datafile.status === Filestatus.Equal)
    );
  });

  readonly iconClass = computed(() => {
    if (this.isReady()) {
      return 'pi pi-check';
    }
    return 'pi pi-spin pi-spinner';
  });

  readonly hostStyle = computed(() => {
    const action = this.datafile().action ?? Fileaction.Ignore;
    let style: FileActionStyle;
    switch (action) {
      case Fileaction.Copy:
        style = getFileActionStyle('COPY');
        break;
      case Fileaction.Update:
        style = getFileActionStyle('UPDATE');
        break;
      case Fileaction.Delete:
        style = getFileActionStyle('DELETE');
        break;
      case Fileaction.Custom:
        style = getFileActionStyle('CUSTOM');
        break;
      default:
        style = getFileActionStyle('IGNORE');
    }
    return buildInlineStyle(style);
  });

  /** Returns true if using Globus plugin */
  readonly isGlobus = computed(
    () => this.credentialsService.plugin$() === 'globus',
  );
}
