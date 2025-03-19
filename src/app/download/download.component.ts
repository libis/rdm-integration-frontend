// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, OnDestroy, OnInit } from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { PluginService } from '../plugin.service';
import { debounceTime, firstValueFrom, map, Observable, Subject, Subscription } from 'rxjs';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';
import { DataService } from '../data.service';
import { UtilsService } from '../utils.service';
import { ActivatedRoute } from '@angular/router';
import { DownladablefileComponent } from '../downloadablefile/downladablefile.component';

@Component({
  selector: 'app-download',
  standalone: false,
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss',
})
export class DownloadComponent implements OnInit, OnDestroy {
  // CONSTANTS
  DEBOUNCE_TIME = 750;

  // NG MODEL FIELDS
  dataverseToken?: string;
  datasetId?: string;
  data: CompareResult = {};
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
  loading = false;

  // ITEMS IN SELECTS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [];

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;

  constructor(
    private dvObjectLookupService: DvObjectLookupService,
    private pluginService: PluginService,
    public dataService: DataService,
    private utils: UtilsService,
    private route: ActivatedRoute,
  ) {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map(searchText => this.datasetSearch(searchText)),
    );
  }

  ngOnInit(): void {
    const dvToken = localStorage.getItem("dataverseToken");
    if (dvToken !== null) {
      this.dataverseToken = dvToken;
    }
    this.route.queryParams
      .subscribe(params => {
        const apiToken = params['apiToken'];
        if (apiToken) {
          this.dataverseToken = apiToken;
        }
        const pid = params['datasetPid'];
        if (pid) {
          this.doiItems = [{ label: pid, value: pid }];
          this.datasetId = pid;
          this.onDatasetChange();
        }
      });
    this.datasetSearchResultsSubscription = this.datasetSearchResultsObservable.subscribe({
      next: x => x.then(v => this.doiItems = v)
        .catch(err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }]),
      error: err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }],
    });
  }

  ngOnDestroy() {
    this.datasetSearchResultsSubscription?.unsubscribe();
  }

  back(): void {
    location.href = "connect";
  }

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  rowClass(datafile: Datafile): string {
    switch (datafile.action) {
      case Fileaction.Ignore:
        return '';
      case Fileaction.Download:
        return 'background-color: #c3e6cb';
      case Fileaction.Custom:
        return 'background-color: #FFFAA0';
    }
    return '';
  }

  onUserChange() {
    this.doiItems = [];
    this.datasetId = undefined;
    if (this.dataverseToken !== undefined && this.pluginService.isStoreDvToken()) {
      localStorage.setItem("dataverseToken", this.dataverseToken!);
    }
  }

  // DV OBJECTS: COMMON

  getDoiOptions(): void {
    if (this.doiItems.length !== 0 && this.doiItems.find(x => x === this.loadingItem) === undefined) {
      return;
    }
    this.doiItems = this.loadingItems;
    this.datasetId = undefined;

    const httpSubscription = this.dvObjectLookupService.getItems("", "Dataset", undefined, this.dataverseToken).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items && items.length > 0) {
          this.doiItems = items;
          this.datasetId = undefined;
        } else {
          this.doiItems = [];
          this.datasetId = undefined;
        }
        httpSubscription.unsubscribe();
      },
      error: (err) => {
        alert("doi lookup failed: " + err.error);
        this.doiItems = [];
        this.datasetId = undefined;
      },
    });
  }

  // DATASETS
  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems = [{ label: 'start typing to search (at least three letters)', value: 'start' }];
      return;
    }
    this.doiItems = [{ label: 'searching "' + searchTerm + '"...', value: searchTerm }];
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(this.dvObjectLookupService.getItems("", "Dataset", searchTerm, this.dataverseToken));
  }

  onDatasetChange() {
    this.loading = true;
    const subscription = this.dataService.getDownloadableFiles(this.datasetId!, this.dataverseToken).subscribe({
      next: (data) => {
        subscription.unsubscribe();
        data.data = data.data?.sort((o1, o2) => (o1.id === undefined ? "" : o1.id) < (o2.id === undefined ? "" : o2.id) ? -1 : 1);
        this.setData(data);
      },
      error: (err) => {
        subscription.unsubscribe();
        alert("getting downloadable files failed: " + err.error);
      }
    });
  }

  setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      this.loading = false;
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach(v => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get("");
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.rootNodeChildren = rootNode.children;
    }
    this.loading = false;
  }

  action(): string {
    const root = this.rowNodeMap.get("")
    if (root) {
      return DownladablefileComponent.actionIcon(root);
    }
    return DownladablefileComponent.icon_ignore;
  }

  toggleAction(): void {
    const root = this.rowNodeMap.get("")
    if (root) {
      DownladablefileComponent.toggleNodeAction(root);
    }
  }

  downloadDisabled(): boolean {
    return !Array.from(this.rowNodeMap.values()).some(x => x.data?.action === Fileaction.Download);
  }

  async download(): Promise<void> {
    //TODO

    const httpSubscription = this.dataService.download().subscribe({
      next: () => {
        httpSubscription.unsubscribe();
      },
      error: (err) => {
        httpSubscription.unsubscribe();
        alert(err);
      },
    });
  }
}

