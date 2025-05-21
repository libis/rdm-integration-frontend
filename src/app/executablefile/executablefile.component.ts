// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, OnInit, inject, input, output } from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { Datafile } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { DataService } from '../data.service';
import { ComputeRequest } from '../models/compare-result';
import { TreeTableModule } from 'primeng/treetable';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Ripple } from 'primeng/ripple';

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
    Ripple,
  ],
})
export class ExecutablefileComponent implements OnInit {
  private pluginService = inject(PluginService);
  dataService = inject(DataService);

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

  node: TreeNode<Datafile> = {};
  queue?: string;
  queues: SelectItem<string>[] = [];
  spinning = false;
  computeEnabled = false;

  constructor() {}

  ngOnInit(): void {
    this.node = this.rowNodeMap().get(
      this.datafile().id! + (this.datafile().attributes?.isFile ? ':file' : ''),
    )!; // avoid collisions between folders and files having the same path and name
    const datafile = this.datafile();
    const splitted = datafile.name?.split('.');
    if (datafile.attributes?.isFile && splitted && splitted?.length > 0) {
      this.queues = this.pluginService.getQueues(splitted[splitted.length - 1]);
    }
  }

  onSelectQueue() {
    if (!this.queue) {
      return;
    }
    this.spinning = true;
    this.computeEnabled = false;
    const subscription = this.dataService
      .checkAccessToQueue(this.pid(), this.dv_token(), this.queue)
      .subscribe({
        next: (access) => {
          subscription.unsubscribe();
          if (access.access) {
            this.computeEnabled = true;
          } else {
            this.queue = undefined;
            alert(access.message);
          }
          this.spinning = false;
        },
        error: (err) => {
          subscription.unsubscribe();
          alert('checking access to queue failed: ' + err.error);
          this.spinning = false;
          this.queue = undefined;
        },
      });
  }

  compute(): void {
    this.computeClicked.emit({
      persistentId: this.pid()!,
      dataverseKey: this.dv_token(),
      queue: this.queue!,
      executable: this.datafile().id!,
      sendEmailOnSuccess: false,
    });
  }
}
