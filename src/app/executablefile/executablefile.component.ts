// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import { Datafile } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { DataService } from '../data.service';
import { NotificationService } from '../shared/notification.service';
import { ComputeRequest } from '../models/compare-result';
import { TreeTableModule } from 'primeng/treetable';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';

@Component({
  selector: 'tr[app-executablefile]',
  templateUrl: './executablefile.component.html',
  styleUrl: './executablefile.component.scss',
  imports: [
    TreeTableModule,
    ProgressSpinner,
    Select,
    FormsModule,
    ButtonDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutablefileComponent {
  private pluginService = inject(PluginService);
  dataService = inject(DataService);
  private notificationService = inject(NotificationService);

  readonly datafile = input<Datafile>({});
  readonly loading = input(true);
  readonly rowNodeMap = input<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly rowNode = input<TreeNode<Datafile>>({});
  readonly pid = input<string>();
  readonly dv_token = input<string>();

  readonly computeClicked = output<ComputeRequest>({ alias: 'computeClicked' });

  icon_play = 'pi pi-play';

  readonly node = computed<TreeNode<Datafile>>(() => {
    const map = this.rowNodeMap();
    const df = this.datafile();
    const key = df.id! + (df.attributes?.isFile ? ':file' : '');
    return map.get(key) ?? {};
  });

  readonly queues = computed<SelectItem<string>[]>(() => {
    const datafile = this.datafile();
    const splitted = datafile.name?.split('.');
    if (datafile.attributes?.isFile && splitted && splitted?.length > 0) {
      return this.pluginService.getQueues(splitted[splitted.length - 1]);
    }
    return [];
  });

  readonly queue = signal<string | undefined>(undefined);
  readonly spinning = signal(false);
  readonly computeEnabled = signal(false);

  onSelectQueue() {
    if (!this.queue()) {
      return;
    }
    this.spinning.set(true);
    this.computeEnabled.set(false);
    let subscription: Subscription;
    subscription = this.dataService
      .checkAccessToQueue(this.pid(), this.dv_token(), this.queue())
      .subscribe({
        next: (access) => {
          subscription?.unsubscribe();
          if (access.access) {
            this.computeEnabled.set(true);
          } else {
            this.queue.set(undefined);
            this.notificationService.showError(access.message);
          }
          this.spinning.set(false);
        },
        error: (err) => {
          subscription?.unsubscribe();
          this.notificationService.showError(
            `Checking access to queue failed: ${err.error}`,
          );
          this.spinning.set(false);
          this.queue.set(undefined);
        },
      });
  }

  compute(): void {
    this.computeClicked.emit({
      persistentId: this.pid()!,
      dataverseKey: this.dv_token(),
      queue: this.queue()!,
      executable: this.datafile().id!,
      sendEmailOnSuccess: false,
    });
  }
}
