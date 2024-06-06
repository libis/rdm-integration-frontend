// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { Datafile } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { DataService } from '../data.service';
import { ComputeRequest } from '../models/compare-result';

@Component({
  selector: 'tr[app-executablefile]',
  templateUrl: './executablefile.component.html',
  styleUrl: './executablefile.component.scss'
})
export class ExecutablefileComponent implements OnInit {

  @Input("datafile") datafile: Datafile = {};
  @Input("loading") loading = true;
  @Input("rowNodeMap") rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
  @Input("rowNode") rowNode: TreeNode<Datafile> = {};
  @Input("pid") pid?: string;
  @Input("dv_token") dv_token?: string;

  @Output('computeClicked') computeClicked = new EventEmitter<ComputeRequest>();

  icon_play = "pi pi-play";

  node: TreeNode<Datafile> = {};
  queue?: string;
  queues: SelectItem<string>[] = [];
  spinning = false;
  computeEnabled = false;

  constructor(private pluginService: PluginService, public dataService: DataService) { }

  ngOnInit(): void {
    this.node = this.rowNodeMap.get(this.datafile.id! + (this.datafile.attributes?.isFile ? ":file" : ""))!; // avoid collisions between folders and files having the same path and name
    const splitted = this.datafile.name?.split('.');
    if (this.datafile.attributes?.isFile && splitted && splitted?.length > 0) {
      this.queues = this.pluginService.getQueues(splitted[splitted.length - 1]);
    }
  }

  onSelectQueue() {
    if (!this.queue) {
      return;
    }
    this.spinning = true;
    this.computeEnabled = false;
    const subscription = this.dataService.checkAccessToQueue(this.pid, this.dv_token, this.queue).subscribe({
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
        alert("checking access to queue failed: " + err.error);
        this.spinning = false;
        this.queue = undefined;
      }
    });
  }

  compute(): void {
    this.computeClicked.emit({
      persistentId: this.pid!,
      dataverseKey: this.dv_token,
      queue: this.queue!,
      executable: this.datafile.id!,
      sendEmailOnSuccess: false,
    });
  }
}
