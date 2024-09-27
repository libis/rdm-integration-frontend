/* eslint-disable @typescript-eslint/no-explicit-any */
 
// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { TreeNode } from 'primeng/api';
import { CredentialsService } from '../credentials.service';
import { FolderActionUpdateService } from '../folder.action.update.service';
import { PluginService } from '../plugin.service';
import { UtilsService } from '../utils.service';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {

  icon_noaction = "pi pi-stop";
  icon_update = "pi pi-copy";
  icon_mirror = "pi pi-sync";
  icon_submit = "pi pi-save";
  icon_compare = "pi pi-flag";
  icon_action = "pi pi-bolt";
  icon_warning = "pi pi-exclamation-triangle";

  disabled = true;
  loading = true;
  refreshHidden = true;
  isInFilterMode = false;
  maxFileSize?: number;
  rejected?: string[];

  data: CompareResult = {};
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();

  filterItems: any[] = [
    {
      label: '(New files)',
      icon: 'pi pi-plus-circle',
      iconStyle: { 'color': 'green' },
      title: "Files that aren't in the dataset yet",
      fileStatus: Filestatus.New,
    }, {
      label: '(Changed files)',
      icon: 'pi pi-exclamation-circle',
      iconStyle: { 'color': 'blue' },
      title: 'Files that are not the same in the dataset and the active data repository, but share the same file name and/or file path',
      fileStatus: Filestatus.Updated,
    }, {
      label: '(Unchanged files)',
      icon: 'pi pi-check-circle',
      iconStyle: { 'color': 'black' },
      title: 'Files that are the same in the dataset and the active data repository',
      fileStatus: Filestatus.Equal,
    }, {
      label: '(Files only in RDR)',
      icon: 'pi pi-minus-circle',
      iconStyle: { 'color': 'red' },
      title: 'Files that are only in the dataset, but not in the active data repository',
      fileStatus: Filestatus.Deleted,
    }];

  selectedFilterItems: any[] = [this.filterItems[0], this.filterItems[1], this.filterItems[2], this.filterItems[3]];

  constructor(
    public dataUpdatesService: DataUpdatesService,
    public dataStateService: DataStateService,
    private credentialsService: CredentialsService,
    private router: Router,
    private folderActionUpdateService: FolderActionUpdateService,
    private pluginService: PluginService,
    private utils: UtilsService,
  ) { }

  ngOnInit(): void {
    if (this.dataStateService.getCurrentValue() != null) {
      this.dataStateService.initializeState(this.credentialsService.credentials);
    }
    this.setUpdatedDataSubscription();
  }

  setUpdatedDataSubscription() {
    const initialStateSubscription = this.dataStateService.getObservableState().subscribe((data) => {
      if (data !== null) {
        initialStateSubscription.unsubscribe();
        this.setData(data);
        if (data.data && data.id) {
          this.maxFileSize = data.maxFileSize;
          this.rejected = data.rejected;
          if (this.data.status !== ResultStatus.Updating) {
            this.disabled = false;
            this.loading = false;
          } else {
            this.getUpdatedData(0);
          }
        }
      }
    });
  }

  getUpdatedData(cnt: number): void {
    const subscription = this.dataUpdatesService.updateData(this.data.data!, this.data.id!).subscribe(async (data: CompareResult) => {
      cnt++;
      subscription.unsubscribe();
      if (data.data && data.id) {
        this.setData(data);
      }
      if (this.data.status !== ResultStatus.Updating) {
        this.disabled = false;
        this.loading = false;
      } else if (cnt > 10) {
        this.loading = false;
        this.refreshHidden = false;
      } else {
        await this.utils.sleep(1000);
        this.getUpdatedData(cnt);
      }
    });
  }

  refresh(): void {
    const subscription = this.dataUpdatesService.updateData(this.data.data!, this.data.id!).subscribe((data) => {
      subscription.unsubscribe();
      if (data.data && data.id) {
        this.setData(data);
      }
      if (this.data.status !== ResultStatus.Updating) {
        this.disabled = false;
      } else {
        this.refreshHidden = true;
      }
    });
  }

  rowClass(datafile: Datafile): string {
    switch (datafile.action) {
      case Fileaction.Ignore:
        return '';
      case Fileaction.Copy:
        return 'background-color: #c3e6cb';
      case Fileaction.Update:
        return 'background-color: #b8daff';
      case Fileaction.Delete:
        return 'background-color: #f5c6cb';
      case Fileaction.Custom:
        return 'background-color: #FFFAA0';
    }
    return '';
  }

  noActionSelection(): void {
    this.rowNodeMap.forEach(rowNode => {
      const datafile = rowNode.data!;
      if (datafile.hidden) {
        return;
      }
      datafile.action = Fileaction.Ignore
    });
  }

  updateSelection(): void {
    this.rowNodeMap.forEach(rowNode => {
      const datafile = rowNode.data!;
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
    this.rowNodeMap.forEach(rowNode => {
      const datafile = rowNode.data!;
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

  updateFilters(): void {
    if (this.selectedFilterItems.length < 4) {
      this.filterOn(this.selectedFilterItems);
    } else {
      this.filterOff();
    }
  }

  showAll(): void {
    this.selectedFilterItems = [];
    this.selectedFilterItems.push(...this.filterItems);
    this.filterOff();
  }

  filterOn(filters: any[]): void {
    const nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach(rowNode => {
      const datafile = rowNode.data!;
      datafile.hidden = !datafile.attributes?.isFile || !filters.some(i => datafile.status === i.fileStatus);
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.isInFilterMode = true;
  }

  filterOff(): void {
    this.rowNodeMap.forEach(rowNode => {
      const datafile = rowNode.data!;
      datafile.hidden = false;
    });
    this.rootNodeChildren = this.rowNodeMap.get("")!.children!;
    this.isInFilterMode = false;
    this.folderActionUpdateService.updateFoldersAction(this.rowNodeMap);
  }

  submit(): void {
    this.dataStateService.updateState(this.data);
    this.router.navigate(['/submit']);
  }

  setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      return;
    }
    const rowDataMap = this.mapDatafiles(data.data);
    rowDataMap.forEach(v => this.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get("");
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.updateFoldersStatus(rootNode);
      this.rootNodeChildren = rootNode.children;
    }
  }

  updateFoldersStatus(node: TreeNode<Datafile>): void {
    if (node.data?.status !== undefined) {
      return;
    }
    node.children?.forEach(v => this.updateFoldersStatus(v));

    let allDeleted = true;
    let allNew = true;
    let allEqual = true;
    let anyUnknown = false;
    node.children?.forEach(v => {
      allDeleted = allDeleted && v.data?.status === Filestatus.Deleted;
      allNew = allNew && v.data?.status === Filestatus.New;
      allEqual = allEqual && v.data?.status === Filestatus.Equal;
      anyUnknown = anyUnknown || v.data?.status === Filestatus.Unknown;
    });

    let status;
    if (anyUnknown) status = Filestatus.Unknown
    else if (allEqual) status = Filestatus.Equal
    else if (allDeleted) status = Filestatus.Deleted
    else if (allNew) status = Filestatus.New
    else status = Filestatus.Updated;
    node.data!.status = status;
  }

  addChild(v: TreeNode<Datafile>, rowDataMap: Map<string, TreeNode<Datafile>>): void {
    if (v.data!.id === "") {
      return;
    }
    const parent = rowDataMap.get(v.data!.path!)!;
    const children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  mapDatafiles(data: Datafile[]): Map<string, TreeNode<Datafile>> {
    const rootData: Datafile = {
      path: "",
      name: "",
      action: Fileaction.Ignore,
      hidden: false,
      id: "",
    }

    const rowDataMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
    rowDataMap.set("", {
      data: rootData,
    });

    data.forEach((d) => {
      let path = "";
      d.path!.split("/").forEach((folder) => {
        const id = path != "" ? path + "/" + folder : folder;
        const folderData: Datafile = {
          path: path,
          name: folder,
          action: Fileaction.Ignore,
          hidden: false,
          id: id,
        }
        rowDataMap.set(id, {
          data: folderData,
        });
        path = id;
      });
      rowDataMap.set(d.id! + ":file", { // avoid collisions between folders and files having the same path and name
        data: d,
      });
    });
    return rowDataMap;
  }

  back(): void {
    location.href = "connect";
  }

  repo(): string {
    return this.pluginService.getPlugin(this.credentialsService.credentials.pluginId).name;
  }

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }
}
