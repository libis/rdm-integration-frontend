// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

// Services
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NotificationService } from '../shared/notification.service';
import { SubmitService } from '../submit.service';
import { UtilsService } from '../utils.service';

// Models
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';
import { LoginState } from '../models/oauth';
import { RepoPlugin } from '../models/plugin';
import { RepoLookupRequest } from '../models/repo-lookup';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { PrimeTemplate, SelectItem, TreeNode } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { FloatLabel } from 'primeng/floatlabel';
import { Select } from 'primeng/select';
import { Tree } from 'primeng/tree';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { DownladablefileComponent } from '../downloadablefile/downladablefile.component';

// RxJS
import { debounceTime, firstValueFrom, map, Observable, Subject } from 'rxjs';

// Constants and types
import { APP_CONSTANTS, getFileActionClass } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-download',
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss',
  imports: [
    ButtonDirective,
    FormsModule,
    FloatLabel,
    Select,
    TreeTableModule,
    PrimeTemplate,
    DownladablefileComponent,
    Tree,
    Button,
  ],
})
export class DownloadComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  private readonly pluginService = inject(PluginService);
  dataService = inject(DataService);
  submit = inject(SubmitService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly repoLookupService = inject(RepoLookupService);
  private readonly oauth = inject(OauthService);
  private readonly notificationService = inject(NotificationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS
  dataverseToken?: string;
  datasetId?: string;
  data?: CompareResult;
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<
    string,
    TreeNode<Datafile>
  >();
  loading = false;

  // ITEMS IN SELECTS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [];

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  downloadRequested = false;

  // globus
  token?: string;
  repoNames: SelectItem<string>[] = [];
  selectedRepoName?: string;
  foundRepoName?: string;
  repoSearchSubject: Subject<string> = new Subject();
  repoSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  repoSearchResultsSubscription?: Subscription;
  branchItems: SelectItem<string>[] = [];
  option?: string;
  rootOptions: TreeNode<string>[] = [
    { label: 'Expand and select', data: '', leaf: false, selectable: true },
  ];
  selectedOption?: TreeNode<string>;
  optionsLoading = false;
  globusPlugin?: RepoPlugin;
  downloadId?: string;

  constructor() {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );
    this.repoSearchResultsObservable = this.repoSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.repoNameSearch(searchText)),
    );
  }

  async ngOnInit() {
    await this.pluginService.setConfig();
    const dvToken = localStorage.getItem('dataverseToken');
    if (dvToken !== null) {
      this.dataverseToken = dvToken;
    }
    this.route.queryParams.subscribe((params) => {
      const apiToken = params['apiToken'];
      if (apiToken) {
        this.dataverseToken = apiToken;
      }
      const pid = params['datasetPid'];
      if (pid) {
        this.doiItems = [{ label: pid, value: pid }];
        this.datasetId = pid;
      }
      this.downloadId = params['downloadId'];
      const code = params['code'];
      if (code !== undefined) {
        const loginState: LoginState = JSON.parse(params['state']);
        if (loginState.nonce) {
          const doi = loginState.datasetId?.value
            ? loginState.datasetId?.value
            : '?';
          this.doiItems = [{ label: doi, value: doi }];
          this.datasetId = doi;
          this.onDatasetChange();
          const tokenSubscription = this.oauth
            .getToken('globus', code, loginState.nonce)
            .subscribe((x) => {
              this.token = x.session_id;
              if (!this.pluginService.isStoreDvToken()) {
                localStorage.removeItem('dataverseToken');
              }
              tokenSubscription.unsubscribe();
            });
        }
        this.globusPlugin = this.pluginService.getGlobusPlugin();
      } else {
        this.globusPlugin = this.pluginService.getGlobusPlugin();
        this.getRepoToken();
      }
    });
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.doiItems = v))
            .catch(
              (err) =>
                (this.doiItems = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.doiItems = [
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
    this.repoSearchResultsSubscription =
      this.repoSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.repoNames = v))
            .catch(
              (err) =>
                (this.repoNames = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.repoNames = [
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });

    // Auto-load dataset options on init
    this.getDoiOptions();
  }

  ngOnDestroy() {
    this.datasetSearchResultsSubscription?.unsubscribe();
    this.repoSearchResultsSubscription?.unsubscribe();
  }

  back(): void {
    location.href = 'connect';
  }

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  rowClass(datafile: Datafile): string {
    switch (datafile.action) {
      case Fileaction.Ignore:
        return '';
      case Fileaction.Download:
        return getFileActionClass('COPY');
      case Fileaction.Custom:
        return getFileActionClass('CUSTOM');
    }
    return '';
  }

  onUserChange() {
    this.doiItems = [];
    this.datasetId = undefined;
    if (
      this.dataverseToken !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken!);
    }
  }

  // DV OBJECTS: COMMON
  getDoiOptions(): void {
    if (
      this.doiItems.length !== 0 &&
      this.doiItems.find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.doiItems = this.loadingItems;
    this.datasetId = undefined;

    const httpSubscription = this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken)
      .subscribe({
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
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
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
      this.doiItems = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.doiItems = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken,
      ),
    );
  }

  onDatasetChange() {
    this.loading = true;
    const subscription = this.dataService
      .getDownloadableFiles(this.datasetId!, this.dataverseToken)
      .subscribe({
        next: (data) => {
          subscription.unsubscribe();
          data.data = data.data?.sort((o1, o2) =>
            (o1.id === undefined ? '' : o1.id) <
            (o2.id === undefined ? '' : o2.id)
              ? -1
              : 1,
          );
          this.setData(data);
        },
        error: (err) => {
          subscription.unsubscribe();
          this.notificationService.showError(
            `Getting downloadable files failed: ${err.error}`,
          );
        },
      });
  }

  setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      this.loading = false;
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.rootNodeChildren = rootNode.children;
    }
    this.loading = false;
  }

  action(): string {
    const root = this.rowNodeMap.get('');
    if (root) {
      return DownladablefileComponent.actionIcon(root);
    }
    return DownladablefileComponent.icon_ignore;
  }

  toggleAction(): void {
    const root = this.rowNodeMap.get('');
    if (root) {
      DownladablefileComponent.toggleNodeAction(root);
    }
  }

  downloadDisabled(): boolean {
    return (
      this.downloadRequested ||
      !this.option ||
      !Array.from(this.rowNodeMap.values()).some(
        (x) => x.data?.action === Fileaction.Download,
      )
    );
  }

  async download(): Promise<void> {
    const selected: Datafile[] = [];
    this.rowNodeMap.forEach((datafile) => {
      if (datafile.data?.action === Fileaction.Download) {
        selected.push(datafile.data);
      }
    });
    this.downloadRequested = true;
    const httpSubscription = this.submit
      .download(
        selected,
        this.getRepoName(),
        this.option,
        this.token,
        this.datasetId,
        this.dataverseToken,
        this.downloadId,
      )
      .subscribe({
        next: (submissionId) => {
          httpSubscription.unsubscribe();
          this.notificationService.showSuccess(
            `Download is requested and can be monitored in the Globus UI with the following submission ID: ${submissionId}`,
          );
        },
        error: (err) => {
          console.error('something went wrong: ');
          console.error(`${err.error}`);
          this.notificationService.showError(
            `Download request failed: ${err.error}`,
          );
          httpSubscription.unsubscribe();
        },
      });
  }

  // globus
  getRepoNameFieldName(): string | undefined {
    return this.globusPlugin?.repoNameFieldName;
  }

  getRepoName(): string | undefined {
    if (this.selectedRepoName !== undefined) {
      return this.selectedRepoName;
    }
    return this.foundRepoName;
  }

  async repoNameSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    const req = this.getRepoLookupRequest(true);
    if (req === undefined) {
      return [{ label: 'error', value: 'error' }];
    }
    req.repoName = searchTerm;
    return await firstValueFrom(this.repoLookupService.search(req));
  }

  getRepoLookupRequest(isSearch: boolean): RepoLookupRequest | undefined {
    if (
      this.getRepoNameFieldName() &&
      (this.getRepoName() === undefined || this.getRepoName() === '') &&
      !isSearch
    ) {
      this.notificationService.showError(
        `${this.getRepoNameFieldName()} is missing`,
      );
      return;
    }
    if (
      this.branchItems.length !== 0 &&
      this.branchItems.find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.branchItems = this.loadingItems;

    return {
      pluginId: 'globus',
      plugin: 'globus',
      repoName: this.getRepoName(),
      url: this.globusPlugin?.sourceUrlFieldValue,
      token: this.token,
    };
  }

  repoNameFieldEditable(): boolean {
    const v = this.globusPlugin?.repoNameFieldEditable;
    return v === undefined ? false : v;
  }

  getRepoNamePlaceholder(): string {
    const v = this.globusPlugin?.repoNameFieldPlaceholder;
    return v === undefined ? '' : v;
  }

  onRepoNameSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.repoNames = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.repoNames = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.repoSearchSubject.next(searchTerm);
  }

  startRepoSearch() {
    if (this.foundRepoName !== undefined) {
      return;
    }
    if (this.repoNameSearchInitEnabled()) {
      this.repoNames = [{ label: 'loading...', value: 'start' }];
      this.repoSearchSubject.next('');
    } else {
      this.repoNames = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
    }
  }

  repoNameSearchInitEnabled(): boolean | undefined {
    return this.globusPlugin?.repoNameFieldHasInit;
  }

  getOptionFieldName(): string | undefined {
    return this.globusPlugin?.optionFieldName;
  }

  getOptions(node?: TreeNode<string>): void {
    const req = this.getRepoLookupRequest(false);
    if (req === undefined) {
      return;
    }
    if (node) {
      req.option = node.data;
      this.optionsLoading = true;
    }

    const httpSubscription = this.repoLookupService.getOptions(req).subscribe({
      next: (items: SelectItem<string>[]) => {
        if (items && node) {
          const nodes: TreeNode<string>[] = [];
          items.forEach((i) =>
            nodes.push({
              label: i.label,
              data: i.value,
              leaf: false,
              selectable: true,
            }),
          );
          node.children = nodes;
          this.optionsLoading = false;
        } else if (items && items.length > 0) {
          this.branchItems = items;
        } else {
          this.branchItems = [];
        }
        httpSubscription.unsubscribe();
      },
      error: (err) => {
        this.notificationService.showError(
          `Branch lookup failed: ${err.error}`,
        );
        this.branchItems = [];
        this.option = undefined;
        this.optionsLoading = false;
      },
    });
  }

  optionSelected(node: TreeNode<string>): void {
    const v = node.data;
    if (!v || v === '') {
      this.selectedOption = undefined;
      this.option = undefined;
    } else {
      this.option = v;
      this.selectedOption = node;
    }
  }

  onRepoChange() {
    this.branchItems = [];
    this.option = undefined;
  }

  getRepoToken() {
    if (this.dataverseToken !== undefined) {
      localStorage.setItem('dataverseToken', this.dataverseToken!);
    }
    const tg = this.globusPlugin?.tokenGetter;
    if (tg === undefined) {
      return;
    }
    let url =
      this.globusPlugin?.sourceUrlFieldValue +
      (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nonce = this.newNonce(44);
      const loginState: LoginState = {
        datasetId: { value: this.datasetId, label: this.datasetId },
        nonce: nonce,
        download: true,
      };
      let clId = '?client_id=';
      if (url.includes('?')) {
        clId = '&client_id=';
      }
      url = `${
        url + clId + encodeURIComponent(tg.oauth_client_id)
      }&redirect_uri=${this.pluginService.getRedirectUri()}&response_type=code&state=${encodeURIComponent(
        JSON.stringify(loginState),
      )}`;
      location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }

  newNonce(length: number): string {
    let result = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
  }
}
