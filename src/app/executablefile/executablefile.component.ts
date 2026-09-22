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
import { TreeNode } from '../models/tree-node';
import { SelectItem } from '../models/select-item';
import { Subscription } from 'rxjs';
import { Datafile } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { DataService } from '../data.service';
import { NotificationService } from '../shared/notification.service';
import { ComputeRequest } from '../models/compare-result';
import { TreeTogglerComponent } from '../shared/ui/tree-table/tree-toggler.component';
import { SelectComponent } from '../shared/ui/select/select.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'div[app-executablefile]',
  templateUrl: './executablefile.component.html',
  styleUrl: './executablefile.component.scss',
  imports: [TreeTogglerComponent, SelectComponent, FormsModule],
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
  readonly node = input.required<TreeNode<Datafile>>();
  readonly level = input(0);
  readonly toggle = output<void>();
  readonly pid = input<string>();
  readonly dv_token = input<string>();

  readonly computeClicked = output<ComputeRequest>({ alias: 'computeClicked' });

  icon_play = 'pi pi-play';

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
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
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
