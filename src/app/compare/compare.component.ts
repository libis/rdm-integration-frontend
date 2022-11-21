import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';i
import { interval, Subscription, switchMap } from 'rxjs';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { TreeNode } from 'primeng/api';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss']
})
export class CompareComponent implements OnInit {

  data: CompareResult = {};
  updatedDataSubscription?: Subscription;

  icon_noaction = "pi pi-stop";
  icon_update = "pi pi-arrow-right";
  icon_mirror = "pi pi-arrows-h";

  icon_submit = "pi pi-save";

  icon_compare = "pi pi-flag";
  icon_action = "pi pi-bolt";

  disabled = true;
  loading = true;
  refreshHidden = true;


  background_new = "transparent"
  background_equal = "transparent"
  background_not_equal = "transparent"
  background_deleted = "transparent"
  background_all = "#b8daff"

  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();

  isInFilterMode = false;

  constructor(
    public dataUpdatesService: DataUpdatesService,
    public dataStateService: DataStateService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.setUpdatedDataSubscription();
  }

  ngOnDestroy(): void {
    this.updatedDataSubscription?.unsubscribe();
  }

  setUpdatedDataSubscription() {
    let initialStateSubscription = this.dataStateService.getObservableState().subscribe((data) => {
      if (data !== null) {
        initialStateSubscription.unsubscribe();
        this.setData(data);
        if (data.data && data.id) {
          if (this.data.status !== ResultStatus.Updating) {
            this.disabled = false;
            this.loading = false;
            console.log("loaded; no hashing needed")
          } else {
            this.updatedDataSubscription = this.getUpdatedDataSubscription();
          }
        }
      }
    });
  }

  getUpdatedDataSubscription(): Subscription {
    let cnt = 0;
    return interval(5000).pipe(
      switchMap(() => this.dataUpdatesService.updateData(this.data.data!, this.data.id!))
    ).subscribe((data: CompareResult) => {
      cnt++;
      if (data.data && data.id) {
        this.setData(data);
      }
      if (this.data.status !== ResultStatus.Updating) {
        this.updatedDataSubscription?.unsubscribe();
        this.disabled = false;
        this.loading = false;
        console.log("loaded")
      } else if (cnt > 10) {
        this.updatedDataSubscription?.unsubscribe();
        this.loading = false;
        this.refreshHidden = false;
        console.log("timeout, stopped loading")
      }
    });
  }

  refresh(): void {
    let subscription = this.dataUpdatesService.updateData(this.data.data!, this.data.id!).subscribe((data) => {
      if (data.data && data.id) {
        this.setData(data);
      }
      if (this.data.status !== ResultStatus.Updating) {
        this.disabled = false;
      } else {
        this.refreshHidden = true;
      }
      subscription.unsubscribe();
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
      let datafile = rowNode.data!;
      if (datafile.hidden) {
        return;
      }
      datafile.action = Fileaction.Ignore
    });
  }

  updateSelection(): void {
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
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
      let datafile = rowNode.data!;
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

  filterNew(): void {
    let nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
      datafile.hidden = datafile.status !== Filestatus.New || !datafile.attributes?.isFile;
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.background_new = "#b8daff"
    this.background_equal = "transparent"
    this.background_not_equal = "transparent"
    this.background_deleted = "transparent"
    this.background_all = "transparent"
    this.isInFilterMode = true;
  }

  filterEqual(): void {
    let nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
      datafile.hidden = datafile.status !== Filestatus.Equal || !datafile.attributes?.isFile;
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.background_new = "transparent"
    this.background_equal = "#b8daff"
    this.background_not_equal = "transparent"
    this.background_deleted = "transparent"
    this.background_all = "transparent"
    this.isInFilterMode = true;
  }

  filterUpdated(): void {
    let nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
      datafile.hidden = datafile.status !== Filestatus.Updated || !datafile.attributes?.isFile;
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.background_new = "transparent"
    this.background_equal = "transparent"
    this.background_not_equal = "#b8daff"
    this.background_deleted = "transparent"
    this.background_all = "transparent"
    this.isInFilterMode = true;
  }

  filterDeleted(): void {
    let nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
      datafile.hidden = datafile.status !== Filestatus.Deleted || !datafile.attributes?.isFile;
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.background_new = "transparent"
    this.background_equal = "transparent"
    this.background_not_equal = "transparent"
    this.background_deleted = "#b8daff"
    this.background_all = "transparent"
    this.isInFilterMode = true;
  }

  filterNone(): void {
    this.rowNodeMap.forEach(rowNode => {
      let datafile = rowNode.data!;
      datafile.hidden = false;
    });
    this.rootNodeChildren = this.rowNodeMap.get("")!.children!;
    this.background_new = "transparent"
    this.background_equal = "transparent"
    this.background_not_equal = "transparent"
    this.background_deleted = "transparent"
    this.background_all = "#b8daff"
    this.isInFilterMode = false;
  }

  submit(): void {
    console.log("updating state...");
    this.dataStateService.updateState(this.data);
    this.router.navigate(['/submit']);
  }

  setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      return;
    }
    let rowDataMap = this.mapDatafiles(data.data);
    rowDataMap.forEach(v => this.addChild(v, rowDataMap));
    let rootNode = rowDataMap.get("");
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

    var status;
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
    let parent = rowDataMap.get(v.data!.path!)!;
    let children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  mapDatafiles(data: Datafile[]): Map<string, TreeNode<Datafile>> {
    let rootData: Datafile = {
      path: "",
      name: "",
      action: Fileaction.Ignore,
      hidden: false,
      id: "",
    }

    let rowDataMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
    rowDataMap.set("", {
      data: rootData,
    });

    data.forEach((d) => {
      let path = "";
      d.path!.split("/").forEach((folder) => {
        let id = path != "" ? path + "/" + folder : folder;
        let folderData: Datafile = {
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
      rowDataMap.set(d.id!, {
        data: d,
      });
    });
    return rowDataMap;
  }

}
