// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, OnDestroy, OnInit } from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { PluginService } from '../plugin.service';
import { debounceTime, firstValueFrom, map, Observable, Subject, Subscription } from 'rxjs';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CachedComputeResponse, CompareResult, ComputeRequest, Key } from '../models/compare-result';
import { Datafile } from '../models/datafile';
import { DataService } from '../data.service';
import { UtilsService } from '../utils.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-compute',
  templateUrl: './compute.component.html',
  styleUrl: './compute.component.scss',
})
export class ComputeComponent implements OnInit, OnDestroy {

  icon_play = "pi pi-play";

  // CONSTANTS
  DEBOUNCE_TIME = 750;

  // NG MODEL FIELDS
  dataverseToken?: string;
  datasetId?: string;
  output = "";
  data: CompareResult = {};
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
  loading = false;
  popup = false;
  outputDisabled = true;
  sendEmailOnSuccess = false;

  // ITEMS IN DROPDOWNS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' }
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [];

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  req?: ComputeRequest;

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
      const pid = params['datasetPid'];
      if (pid) {
        this.datasetId = pid;
        this.onDatasetChange()
      }
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

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  onDatasetChange() {
    this.loading = true;
    this.output = '';
    this.outputDisabled = true;
    this.datasetSearchResultsSubscription = this.datasetSearchResultsObservable.subscribe({
      next: x => x.then(v => this.doiItems = v)
        .catch(err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }]),
      error: err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }],
    });
    const subscription = this.dataService.getExecutableFiles(this.datasetId!, this.dataverseToken).subscribe({
      next: (data) => {
        subscription.unsubscribe();
        this.setData(data);
      },
      error: (err) => {
        subscription.unsubscribe();
        alert("getting executable files failed: " + err.error);
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

  submitCompute(req: ComputeRequest): void {
    this.req = req;
    this.popup = true;
  }

  continueSubmit() {
    this.popup = false;
    this.loading = true;
    this.req!.sendEmailOnSuccess = this.sendEmailOnSuccess;
    const httpSubscription = this.dataService.compute(this.req!).subscribe({
      next: (key: Key) => {
        httpSubscription.unsubscribe();
        this.getComputeData(key);
      },
      error: (err) => {
        httpSubscription.unsubscribe();
        alert(err);
      },
    });
  }

  sendMails(): boolean {
    return this.pluginService.sendMails();
  }

  private getComputeData(key: Key): void {
    const subscription = this.dataService.getCachedComputeData(key).subscribe({
      next: async (res: CachedComputeResponse) => {
        subscription.unsubscribe();
        if (res.ready === true) {
          this.loading = false;
          if (res.res) {
            this.output = res.res;
          }
          if (res.err && res.err !== "") {
            alert(res.err);
          } else {
            this.outputDisabled = false;
          }
        } else {
          if (res.res) {
            this.output = res.res;
          }
          await this.utils.sleep(1000);
          this.getComputeData(key);
        }
      },
      error: (err) => {
        subscription.unsubscribe();
        this.loading = false;
        alert("getting computation results failed: " + err.error);
      }
    });
  }
}

