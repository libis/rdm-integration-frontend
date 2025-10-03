// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, OnDestroy, inject, viewChild } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

// Services
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { RepoLookupService } from '../repo.lookup.service';
import { PluginService } from '../plugin.service';
import { ActivatedRoute } from '@angular/router';
import { OauthService } from '../oauth.service';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { ConnectValidationService } from '../shared/connect-validation.service';

// Models
import { Credentials } from '../models/credentials';
import { Item, LoginState } from '../models/oauth';
import { RepoLookupRequest } from '../models/repo-lookup';

// PrimeNG
import { SelectItem, TreeNode, PrimeTemplate } from 'primeng/api';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Select } from 'primeng/select';
import { ButtonDirective } from 'primeng/button';
import {
  Accordion,
  AccordionPanel,
  AccordionHeader,
  AccordionContent,
} from 'primeng/accordion';
import { FormsModule } from '@angular/forms';
import { Skeleton } from 'primeng/skeleton';
import { Tree } from 'primeng/tree';

// RxJS
import {
  debounceTime,
  firstValueFrom,
  map,
  Observable,
  Subject,
  filter,
} from 'rxjs';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

const new_dataset = 'New Dataset';
// Toggle detailed restoration tracing (set false for cleaner logs in production builds)
const RESTORE_TRACE = true; // can be wired to environment flag later

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss'],
  imports: [
    CommonModule,
    ButtonDirective,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Select,
    FormsModule,
    PrimeTemplate,
    Skeleton,
    Tree,
  ],
})
export class ConnectComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly router = inject(Router);
  private readonly dataStateService = inject(DataStateService);
  private readonly datasetService = inject(DatasetService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  private readonly repoLookupService = inject(RepoLookupService);
  private readonly pluginService = inject(PluginService);
  private readonly route = inject(ActivatedRoute);
  private readonly oauth = inject(OauthService);
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly snapshotStorage = inject(SnapshotStorageService);
  private readonly connectValidation = inject(ConnectValidationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  readonly repoNameSelect = viewChild.required<Select>('repoSelect');

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;
  readonly DOI_SELECT_WIDTH: SafeStyle =
    this.sanitizer.bypassSecurityTrustStyle('calc(100% - 12rem)');
  readonly NEW_DATASET = new_dataset;

  // NG MODEL FIELDS

  plugin?: string;
  pluginId?: string;
  user?: string;
  token?: string;
  sourceUrl?: string;
  repoName?: string;
  selectedRepoName?: string;
  foundRepoName?: string;
  option?: string;
  dataverseToken?: string;
  collectionId?: string;
  datasetId?: string;

  // ITEMS IN SELECTS

  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  plugins: SelectItem<string>[] = [];
  pluginIds: SelectItem<string>[] = [];
  repoNames: SelectItem<string>[] = [];
  branchItems: SelectItem<string>[] = [];
  collectionItems: SelectItem<string>[] = [];
  doiItems: SelectItem<string>[] = [];
  rootOptions: TreeNode<string>[] = [
    { label: 'Expand and select', data: '', leaf: false, selectable: true },
  ];
  selectedOption?: TreeNode<string>;
  // Both accordion panels expanded by default
  expandedPanels: string[] = ['0', '1'];

  // INTERNAL STATE VARIABLES

  url?: string;
  pluginIdSelectHidden = true;
  optionsLoading = false;
  showNewDatasetCreatedMessage = false;
  showOtherOptions = false;
  repoSearchSubject: Subject<string> = new Subject();
  collectionSearchSubject: Subject<string> = new Subject();
  datasetSearchSubject: Subject<string> = new Subject();
  repoSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  collectionSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  repoSearchResultsSubscription?: Subscription;
  collectionSearchResultsSubscription?: Subscription;
  datasetSearchResultsSubscription?: Subscription;

  constructor() {
    // Debounced search streams
    this.repoSearchResultsObservable = this.repoSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.repoNameSearch(searchText)),
    );
    this.collectionSearchResultsObservable = this.collectionSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.collectionSearch(searchText)),
    );
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );

    // Idempotent restoration on each navigation end to /connect (component reuse scenario)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.attemptFullRestore('[NavigationEnd]'));
  }

  async ngOnInit() {
    this.attemptFullRestore('[ngOnInit]');
    await this.pluginService.setConfig();
    const dvToken = localStorage.getItem('dataverseToken');
    if (dvToken !== null) {
      this.dataverseToken = dvToken;
    }
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
    this.collectionSearchResultsSubscription =
      this.collectionSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.collectionItems = v))
            .catch(
              (err) =>
                (this.collectionItems = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.collectionItems = [
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
    this.route.queryParams.subscribe((params) => {
      this.handleQueryParams(params);
    });
  }

  private handleQueryParams(params: Record<string, string | undefined>): void {
    // Support explicit reset via query param (?reset=1) or presence of 'reset' without value
    if ('reset' in params) {
      this.performReset();
      return;
    }
    const stateString = params['state'];
    if (!stateString) {
      this.restoreFromDatasetPid(params);
      return;
    }
    this.restoreFromOauthState(params);
  }

  private restoreFromDatasetPid(
    params: Record<string, string | undefined>,
  ): void {
    // If a datasetPid/apiToken is supplied explicitly, treat this as an authoritative navigation
    // and clear any previously persisted snapshot (fresh connect screen with only provided values).
    if (params['datasetPid'] || params['apiToken']) {
      this.snapshotStorage.clearConnect();
      // Also clear current in-memory fields (but keep datasetId once set below)
      this.plugin = undefined;
      this.pluginId = undefined;
      this.user = undefined;
      this.token = undefined;
      this.repoName = undefined;
      this.selectedRepoName = undefined;
      this.foundRepoName = undefined;
      this.option = undefined;
      this.collectionId = undefined; // allow explicit collectionId if later provided
      this.plugins = [];
      this.pluginIds = [];
      this.repoNames = [];
      this.branchItems = [];
      this.collectionItems = [];
      this.doiItems = [];
    }
    const datasetPid = params['datasetPid'];
    if (datasetPid) {
      this.ensureSelectContains(
        this.doiItems,
        datasetPid,
        (items) => (this.doiItems = items),
      );
      this.datasetId = this.datasetId || datasetPid;
    }
    const apiToken = params['apiToken'];
    if (apiToken) {
      this.dataverseToken = apiToken;
    }
    const callback = params['callback'];
    if (callback) {
      this.handleGlobusCallback(callback, apiToken, datasetPid);
    }
  }

  private handleGlobusCallback(
    callback: string,
    apiToken?: string,
    datasetPid?: string,
  ): void {
    const p = this.pluginService.getGlobusPlugin();
    if (!p) return;
    this.plugin = 'globus';
    this.pluginId = 'globus';
    if (datasetPid) return;
    const callbackUrl = atob(callback);
    const parts = callbackUrl.split('/');
    if (parts.length <= 6) return;
    const datasetDbId = parts[6];
    const g = callbackUrl.split('?');
    const globusParams = g[g.length - 1].split('&');
    let downloadId: string | undefined = undefined;
    globusParams.forEach((p) => {
      if (p.startsWith('downloadId=')) {
        downloadId = p.substring('downloadId='.length);
      }
    });
    const versionSubscription = this.datasetService
      .getDatasetVersion(datasetDbId, apiToken)
      .subscribe((x) => {
        this.datasetId = x.persistentId;
        this.subscriptions.delete(versionSubscription);
        versionSubscription.unsubscribe();
        if (downloadId) {
          this.router.navigate(['/download'], {
            queryParams: {
              downloadId: downloadId,
              datasetPid: x.persistentId,
              apiToken: apiToken,
            },
          });
        }
      });
    this.subscriptions.add(versionSubscription);
  }

  private restoreFromOauthState(
    params: Record<string, string | undefined>,
  ): void {
    const stateRaw = params['state'];
    if (typeof stateRaw !== 'string') return;
    let loginState: LoginState;
    try {
      loginState = JSON.parse(stateRaw) as LoginState;
    } catch {
      return; // malformed state
    }
    if (loginState.download) {
      this.router.navigate(['/download'], { queryParams: params });
    }
    this.sourceUrl = loginState.sourceUrl;
    this.url = loginState.url;
    this.repoName = loginState.repoName;
    this.selectedRepoName = loginState.repoName;
    this.foundRepoName = loginState.repoName;
    this.user = loginState.user;

    if (loginState.plugin?.value) {
      this.plugins = [
        { label: loginState.plugin.label, value: loginState.plugin.value! },
      ];
      this.plugin = loginState.plugin.value;
    }
    if (loginState.pluginId?.value) {
      this.pluginIds = [
        { label: loginState.pluginId.label, value: loginState.pluginId.value! },
      ];
      this.pluginId = loginState.pluginId.value;
      this.pluginIdSelectHidden = !!loginState.pluginId.hidden;
    } else {
      this.pluginIdSelectHidden = true;
    }
    if (loginState.option?.value) {
      this.branchItems = [
        { label: loginState.option.label, value: loginState.option.value! },
        this.loadingItem,
      ];
      this.option = loginState.option.value;
    }
    if (loginState.datasetId?.value) {
      this.ensureSelectContains(
        this.doiItems,
        loginState.datasetId.value,
        (items) => (this.doiItems = items),
      );
      this.datasetId = loginState.datasetId.value;
    }
    if (loginState.collectionId?.value) {
      this.ensureSelectContains(
        this.collectionItems,
        loginState.collectionId.value,
        (items) => (this.collectionItems = items),
      );
      this.collectionId = loginState.collectionId.value;
    }
    const code = params['code'];
    if (loginState.nonce && this.pluginId && code) {
      const tokenSubscription = this.oauth
        .getToken(this.pluginId, code, loginState.nonce)
        .subscribe((x) => {
          this.token = x.session_id;
          if (!this.pluginService.isStoreDvToken()) {
            localStorage.removeItem('dataverseToken');
          }
          this.subscriptions.delete(tokenSubscription);
          tokenSubscription.unsubscribe();
        });
      this.subscriptions.add(tokenSubscription);
    }
  }

  private ensureSelectContains(
    target: SelectItem<string>[],
    value: string,
    setter: (items: SelectItem<string>[]) => void,
  ) {
    if (!value) return;
    if (target.some((i) => i.value === value)) return;
    setter([{ label: value, value }, this.loadingItem]);
  }

  private restoreFromSnapshot(historyState: unknown): void {
    if (!historyState || typeof historyState !== 'object') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyState = historyState as any;
    const snap = (anyState.connectSnapshot || {}) as Credentials & {
      collectionId?: string;
    };
    const datasetFromNav = (historyState as { datasetId?: string }).datasetId;
    const collectionFromNav = (historyState as { collectionId?: string })
      .collectionId;
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] restoreFromSnapshot invoked', {
          incomingHistoryState: historyState,
          snapDataset: snap.dataset_id,
          datasetFromNav,
        });
      } catch {
        // intentional: tracing is non-critical
      }
    }
    if (anyState.connectSnapshot) {
      this.applySnapshot(snap, datasetFromNav, collectionFromNav);
    } else if (datasetFromNav || collectionFromNav) {
      // If only primitive ids passed
      this.applySnapshot({}, datasetFromNav, collectionFromNav);
    }
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] restoreFromSnapshot result', {
          datasetId: this.datasetId,
          collectionId: this.collectionId,
          hasSnapshot: !!anyState.connectSnapshot,
        });
      } catch {
        // intentional: ignore tracing error
      }
    }
  }

  private restoreFromStorage(): void {
    const snap = this.snapshotStorage.loadConnect();
    if (!snap) return;
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] restoreFromStorage invoked', snap);
      } catch {
        // intentional: ignore tracing error
      }
    }
    this.applySnapshot(snap, undefined, undefined);
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] restoreFromStorage result', {
          datasetId: this.datasetId,
          collectionId: this.collectionId,
        });
      } catch {
        // intentional: ignore tracing error
      }
    }
  }

  private applySnapshot(
    snap: Partial<Credentials & { collectionId?: string }> | undefined,
    datasetFromNav?: string,
    collectionFromNav?: string,
  ): void {
    if (!snap) return;
    const assignIfEmpty = <T>(
      current: T | undefined,
      incoming: T | undefined,
    ) => current === undefined && incoming !== undefined;
    if (assignIfEmpty(this.plugin, snap.plugin)) this.plugin = snap.plugin;
    if (assignIfEmpty(this.pluginId, snap.pluginId))
      this.pluginId = snap.pluginId;
    if (assignIfEmpty(this.user, snap.user)) this.user = snap.user;
    if (assignIfEmpty(this.token, snap.token)) this.token = snap.token;
    if (assignIfEmpty(this.repoName, snap.repo_name))
      this.repoName = snap.repo_name;
    if (assignIfEmpty(this.selectedRepoName, snap.repo_name))
      this.selectedRepoName = snap.repo_name;
    if (assignIfEmpty(this.foundRepoName, snap.repo_name))
      this.foundRepoName = snap.repo_name;
    if (assignIfEmpty(this.option, snap.option)) this.option = snap.option;
    if (assignIfEmpty(this.dataverseToken, snap.dataverse_token))
      this.dataverseToken = snap.dataverse_token;

    // Dataset precedence logic:
    // 1. Existing this.datasetId (already present) wins.
    // 2. Navigation-provided datasetFromNav (explicit user path) next.
    // 3. Snapshot dataset_id / id fallback.
    if (!this.datasetId) {
      const snapId = (snap as Record<string, unknown>)['id'];
      this.datasetId =
        datasetFromNav ||
        snap.dataset_id ||
        (typeof snapId === 'string' ? snapId : undefined) ||
        this.datasetId;
    }
    // Collection similar precedence; do not overwrite existing selection.
    if (!this.collectionId) {
      const snapCollection = (snap as Record<string, unknown>)['collectionId'];
      this.collectionId =
        collectionFromNav ||
        (typeof snapCollection === 'string' ? snapCollection : undefined) ||
        this.collectionId;
    }

    const ensureList = (
      list: SelectItem<string>[],
      value: string | undefined,
      setter: (items: SelectItem<string>[]) => void,
    ) => {
      if (!value) return;
      if (list.length === 0)
        setter([{ label: value, value }, this.loadingItem]);
    };
    ensureList(this.plugins, this.plugin, (i) => (this.plugins = i));
    ensureList(this.pluginIds, this.pluginId, (i) => (this.pluginIds = i));
    ensureList(this.repoNames, this.repoName, (i) => (this.repoNames = i));
    ensureList(this.branchItems, this.option, (i) => (this.branchItems = i));
    ensureList(this.doiItems, this.datasetId, (i) => (this.doiItems = i));
    ensureList(
      this.collectionItems,
      this.collectionId,
      (i) => (this.collectionItems = i),
    );
  }

  private attemptFullRestore(context: string): void {
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] attemptFullRestore start', {
          context,
          historyState: window?.history?.state,
        });
      } catch {
        // intentional: ignore tracing error
      }
    }
    this.restoreFromSnapshot(window?.history?.state);
    if (!this.datasetId) this.restoreFromStorage();
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] attemptFullRestore end', {
          datasetId: this.datasetId,
          collectionId: this.collectionId,
        });
      } catch {
        // intentional: ignore tracing error
      }
    }
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();

    // Clean up existing observable subscriptions
    this.repoSearchResultsSubscription?.unsubscribe();
    this.collectionSearchResultsSubscription?.unsubscribe();
    this.datasetSearchResultsSubscription?.unsubscribe();
  }

  /***********************
   * OAUTH AND API TOKEN *
   ***********************/

  hasOauthConfig(): boolean {
    return (
      this.pluginService.getPlugin(this.pluginId).tokenGetter
        ?.oauth_client_id !== undefined
    );
  }

  isAuthorized(): boolean {
    return this.token !== undefined;
  }

  showRepoTokenGetter(): boolean {
    return this.pluginService.getPlugin(this.pluginId).showTokenGetter!;
  }

  getRepoToken(scopes?: string) {
    if (this.pluginId === undefined) {
      this.notificationService.showError('Repository type is missing');
      return;
    }
    if (this.dataverseToken !== undefined) {
      localStorage.setItem('dataverseToken', this.dataverseToken!);
    }
    const tg = this.pluginService.getPlugin(this.pluginId).tokenGetter!;
    let url = this.url + (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nonce = this.newNonce(44);
      const pluginId = this.getItem(this.pluginIds, this.pluginId);
      if (pluginId !== undefined) {
        pluginId.hidden = this.pluginIdSelectHidden;
      }
      const loginState: LoginState = {
        sourceUrl: this.sourceUrl,
        url: this.url,
        plugin: this.getItem(this.plugins, this.plugin),
        pluginId: pluginId,
        repoName: this.getRepoName(),
        user: this.user,
        option: this.getItem(this.branchItems, this.option),
        datasetId: this.getItem(this.doiItems, this.datasetId),
        collectionId: this.getItem(this.collectionItems, this.collectionId),
        nonce: nonce,
      };
      let clId = '?client_id=';
      if (url.includes('?')) {
        clId = '&client_id=';
      }
      url = `${
        url + clId + encodeURIComponent(tg.oauth_client_id)
      }&redirect_uri=${encodeURIComponent(
        this.pluginService.getRedirectUri(),
      )}&response_type=code&state=${encodeURIComponent(
        JSON.stringify(loginState),
      )}`;
      // + '&code_challenge=' + nonce + '&code_challenge_method=S256';
      if (scopes) {
        if (url.includes('scope=')) {
          let scopeStr = url.substring(url.indexOf('scope='));
          const and = scopeStr.indexOf('&');
          if (and > 0) {
            scopeStr = scopeStr.substring(0, and);
          }
          url = url.replace(scopeStr, `scope=${encodeURIComponent(scopes)}`);
        } else {
          url = `${url}&scope=${encodeURIComponent(scopes)}`;
        }
      }
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

  getItem(items: SelectItem<string>[], value?: string): Item | undefined {
    if (value === undefined) {
      return undefined;
    }
    const label = items.find((x) => x.value === value)?.label;
    return { label: label, value: value };
  }

  // API TOKEN FIELD

  getTokenFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).tokenFieldName;
  }

  getTokenPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).tokenFieldPlaceholder;
  }

  /***********
   * CONNECT *
   ***********/

  async connect() {
    const subscr = this.http
      .post<string>('api/common/useremail', this.dataverseToken)
      .subscribe({
        next: (useremail) => {
          subscr.unsubscribe();
          if (useremail !== '') {
            const err = this.parseAndCheckFields();
            if (err !== undefined) {
              this.notificationService.showError(err);
              return;
            }
            const tokenName = this.pluginService.getPlugin(
              this.pluginId,
            ).tokenName;
            if (
              this.token !== undefined &&
              tokenName !== undefined &&
              tokenName !== ''
            ) {
              localStorage.setItem(tokenName, this.token);
            }
            const creds: Credentials = {
              pluginId: this.pluginId,
              plugin: this.plugin,
              repo_name: this.getRepoName(),
              url: this.url,
              option: this.option,
              user: this.user,
              token: this.token,
              dataset_id: this.datasetId,
              // New dataset detection must work even when a collection prefix is included (e.g. "root:COLL:New Dataset")
              // Earlier logic only compared full equality with "New Dataset" and failed in prefixed cases, breaking Compare proceed logic.
              newly_created: this.isNewDatasetId(this.datasetId),
              dataverse_token: this.dataverseToken,
            };
            // Persist snapshot BEFORE navigating so a later back() can restore even if navigation state is empty
            this.snapshotStorage.saveConnect({
              plugin: this.plugin,
              pluginId: this.pluginId,
              user: this.user,
              token: this.token,
              repo_name: this.getRepoName(),
              url: this.url,
              option: this.option,
              dataverse_token: this.dataverseToken,
              dataset_id: this.datasetId,
              collectionId: this.collectionId,
            });
            this.dataStateService.initializeState(creds);

            if (
              this.dataverseToken !== undefined &&
              this.pluginService.isStoreDvToken()
            ) {
              localStorage.setItem('dataverseToken', this.dataverseToken!);
            }

            this.router.navigate(['/compare', this.datasetId], {
              state: {
                collectionId: this.collectionId,
                collectionItems: this.collectionItems,
              },
            });
          } else {
            this.notificationService.showError(
              'Unknown user: you need to generate a valid Dataverse API token first',
            );
          }
        },
        error: (err) => {
          subscr.unsubscribe();
          console.error(err);
          this.notificationService.showError(
            'Error getting user: you need to generate a valid Dataverse API token first',
          );
        },
      });
  }

  private isNewDatasetId(id?: string): boolean {
    if (!id) return false;
    // Accept plain 'New Dataset', ':New Dataset' (legacy) or any '<prefix>:New Dataset'
    const tail = id.split(':').pop()?.trim();
    return tail === new_dataset;
  }

  /***********
   * RESET   *
   ***********/
  resetForm() {
    this.performReset();
  }

  private performReset() {
    this.snapshotStorage.clearConnect();
    // Clear all bindable fields
    this.plugin = undefined;
    this.pluginId = undefined;
    this.user = undefined;
    this.token = undefined;
    this.repoName = undefined;
    this.selectedRepoName = undefined;
    this.foundRepoName = undefined;
    this.option = undefined;
    this.dataverseToken = undefined;
    this.collectionId = undefined;
    this.datasetId = undefined;
    this.plugins = [];
    this.pluginIds = [];
    this.repoNames = [];
    this.branchItems = [];
    this.collectionItems = [];
    this.doiItems = [];
    this.rootOptions = [
      { label: 'Expand and select', data: '', leaf: false, selectable: true },
    ];
    this.selectedOption = undefined;
    this.expandedPanels = ['0', '1'];
  }

  private buildValidationContext() {
    return {
      pluginId: this.pluginId,
      datasetId: this.datasetId,
      sourceUrl: this.sourceUrl,
      token: this.token,
      option: this.option,
      user: this.user,
      repoName: this.getRepoName(),
      getSourceUrlFieldName: () => this.getSourceUrlFieldName(),
      getTokenFieldName: () => this.getTokenFieldName(),
      getOptionFieldName: () => this.getOptionFieldName(),
      getUsernameFieldName: () => this.getUsernameFieldName(),
      getRepoNameFieldName: () => this.getRepoNameFieldName(),
      parseUrl: () => this.parseUrl(),
    };
  }

  parseAndCheckFields(): string | undefined {
    const issues = this.connectValidation.gatherIssues(
      this.buildValidationContext(),
    );
    return this.connectValidation.summarizeIssues(issues);
  }

  missingFieldsTitle(): string {
    return this.parseAndCheckFields() ?? 'Ready to connect';
  }

  /**
   * Checks if all required fields are valid without returning error messages
   * Used for reactive validation to determine button state
   */
  isFormValid(): boolean {
    return this.connectValidation.isValid(this.buildValidationContext());
  }

  /**
   * Validates URL parsing without side effects
   * Returns error string if invalid, undefined if valid
   */
  private validateUrlParsing(): string | undefined {
    if (!this.sourceUrl) return 'Source URL is required';

    let toSplit = this.sourceUrl;
    if (toSplit.endsWith('/')) {
      toSplit = toSplit.substring(0, toSplit.length - 1);
    }

    const splitted = toSplit.split('://');
    if (splitted?.length !== 2) {
      return 'Malformed source url';
    }

    const pathParts = splitted[1].split('/');
    if (pathParts?.length <= 2) {
      return 'Malformed source url';
    }

    return undefined;
  }

  /**
   * Determines if the Connect button should be in ready state (blue/primary)
   */
  get isConnectReady(): boolean {
    return this.isFormValid();
  }

  /**
   * Determines the CSS classes for the Connect button
   */
  get connectButtonClass(): string {
    const baseClasses = 'p-button-sm p-button-raised';
    return this.isConnectReady
      ? `${baseClasses} p-button-primary`
      : `${baseClasses} p-button-secondary`;
  }

  /**
   * Triggers validation update - can be called from change handlers
   * This method doesn't do anything but calling it ensures Angular's change detection
   * picks up the validation state changes for the button styling
   */
  private triggerValidationUpdate(): void {
    // Angular change detection will automatically update the getter-based properties
    // This method is mainly for explicit triggering if needed
  }

  parseUrl(): string | undefined {
    if (!this.pluginService.getPlugin(this.pluginId).parseSourceUrlField) {
      this.url = this.getSourceUrlValue();
      return;
    }
    if (!this.sourceUrl) {
      return 'Malformed source url';
    }
    let toSplit = this.sourceUrl!;
    if (toSplit.endsWith('/')) {
      toSplit = toSplit.substring(0, toSplit.length - 1);
    }
    let splitted = toSplit.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.url = `https://${splitted[0]}`;
        this.repoName = splitted.slice(1, splitted.length).join('/');
        if (this.repoName.endsWith('.git')) {
          this.repoName = this.repoName.substring(0, this.repoName.length - 4);
        }
      } else {
        return 'Malformed source url';
      }
    } else {
      return 'Malformed source url';
    }
    return;
  }

  /**********
   * PLUGIN *
   **********/

  getPlugins() {
    this.plugins = this.pluginService.getPlugins();
  }

  changePlugin() {
    const pluginIds = this.pluginService.getPluginIds(this.plugin);
    if (pluginIds.length === 1) {
      this.pluginId = pluginIds[0].value;
    } else {
      this.pluginId = undefined;
    }
    this.pluginIdSelectHidden = pluginIds.length < 2;
    this.changePluginId();
  }

  getPluginIds() {
    this.pluginIds = this.pluginService.getPluginIds(this.plugin);
  }

  changePluginId() {
    this.token = undefined;
    const tokenName = this.pluginService.getPlugin(this.pluginId).tokenName;
    if (tokenName !== undefined && tokenName !== '') {
      const token = localStorage.getItem(tokenName);
      if (token !== null) {
        this.token = token;
      }
    }

    this.sourceUrl = undefined;
    this.branchItems = [];
    this.option = undefined;
    this.url = undefined;
    this.user = undefined;
    this.repoNames = [];
    this.repoName = undefined;
    this.selectedRepoName = undefined;
    this.foundRepoName = undefined;
  }

  /**************
   * REPOSITORY *
   **************/

  // REPO CHOICE: COMMON

  getRepoNameFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).repoNameFieldName;
  }

  getRepoNamePlaceholder(): string {
    const v = this.pluginService.getPlugin(
      this.pluginId,
    ).repoNameFieldPlaceholder;
    return v === undefined ? '' : v;
  }

  repoNameFieldEditable(): boolean {
    const v = this.pluginService.getPlugin(this.pluginId).repoNameFieldEditable;
    return v === undefined ? false : v;
  }

  getRepoName(): string | undefined {
    if (this.repoName !== undefined) {
      return this.repoName;
    }
    if (this.selectedRepoName !== undefined) {
      return this.selectedRepoName;
    }
    return this.foundRepoName;
  }

  getRepoLookupRequest(isSearch: boolean): RepoLookupRequest | undefined {
    if (this.pluginId === undefined) {
      this.notificationService.showError('Repository type is missing');
      return;
    }
    const err = this.parseUrl();
    if (err) {
      this.notificationService.showError(err);
      return;
    }
    if (this.url === undefined || this.url === '') {
      this.notificationService.showError('URL is missing');
      return;
    }
    if (
      this.getUsernameFieldName() &&
      (this.user === undefined || this.user === '')
    ) {
      this.notificationService.showError(
        `${this.getUsernameFieldName()} is missing`,
      );
      return;
    }
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
      this.getTokenFieldName() &&
      (this.token === undefined || this.token === '')
    ) {
      this.notificationService.showError(
        `${this.getTokenFieldName()} is missing`,
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
      pluginId: this.pluginId,
      plugin: this.plugin,
      repoName: this.getRepoName(),
      url: this.url,
      user: this.user,
      token: this.token,
    };
  }

  onRepoChange() {
    this.branchItems = [];
    this.option = undefined;
    this.url = undefined;
    if (this.getRepoNameFieldName() === undefined) {
      this.repoName = undefined;
    }
  }

  // REPO VIA SEARCH

  repoNameSearchEnabled(): boolean {
    return this.pluginService.getPlugin(this.pluginId).repoNameFieldHasSearch!;
  }

  repoNameSearchInitEnabled(): boolean {
    return this.pluginService.getPlugin(this.pluginId).repoNameFieldHasInit!;
  }

  async repoNameSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    const req = this.getRepoLookupRequest(true);
    if (req === undefined) {
      return [{ label: 'error', value: 'error' }];
    }
    req.repoName = searchTerm;
    return await firstValueFrom(this.repoLookupService.search(req));
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

  // REPO VIA URL

  getSourceUrlFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).sourceUrlFieldName;
  }

  getSourceUrlPlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId)
      .sourceUrlFieldPlaceholder;
  }

  getSourceUrlValue(): string | undefined {
    const res = this.pluginService.getPlugin(this.pluginId).sourceUrlFieldValue;
    if (res !== undefined) {
      return res;
    }
    return this.sourceUrl;
  }

  // REPO VIA SELECT

  getPluginRepoNames(): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    this.pluginService
      .getPlugin(this.pluginId)
      .repoNameFieldValues?.forEach((x) => res.push({ label: x, value: x }));
    return res;
  }

  showRepoName() {
    this.repoNameSelect().show();
  }

  // BRANCHES/FOLDERS/OTHER OPTIONS

  getOptionFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).optionFieldName;
  }

  getOptionPlaceholder(): string {
    const v = this.pluginService.getPlugin(
      this.pluginId,
    ).optionFieldPlaceholder;
    return v === undefined ? '' : v;
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
        const errStr: string = err.error;
        const scopesStr = '*scopes*';
        if (errStr.includes(scopesStr)) {
          const scopes = errStr.substring(
            errStr.indexOf(scopesStr) + scopesStr.length,
            errStr.lastIndexOf(scopesStr),
          );
          this.getRepoToken(scopes);
        } else {
          this.notificationService.showError(
            `Branch lookup failed: ${err.error}`,
          );
          this.branchItems = [];
          this.option = undefined;
          this.optionsLoading = false;
        }
      },
    });
  }

  isOptionFieldInteractive(): boolean {
    return this.pluginService.getPlugin(this.pluginId).optionFieldInteractive
      ? true
      : false;
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

  // USER FIELD

  getUsernameFieldName(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).usernameFieldName;
  }

  getUsernamePlaceholder(): string | undefined {
    return this.pluginService.getPlugin(this.pluginId).usernameFieldPlaceholder;
  }

  /****************************************
   * DATAVERSE: DATASET CHOICE AND OPTIONS*
   ****************************************/

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  // DATAVERSE API TOKEN

  showDVTokenGetter(): boolean {
    return this.pluginService.showDVTokenGetter();
  }

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  getDataverseToken(): void {
    const url = `${this.pluginService.getExternalURL()}/dataverseuser.xhtml?selectTab=apiTokenTab`;
    window.open(url, '_blank');
  }

  onUserChange() {
    this.doiItems = [];
    this.collectionItems = [];
    this.datasetId = undefined;
    this.collectionId = undefined;
    if (
      this.dataverseToken !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken!);
    }
  }

  // DV OBJECTS: COMMON

  getDvObjectOptions(
    objectType: string,
    dvItems: SelectItem<string>[],
    setter: (comp: ConnectComponent, items: SelectItem<string>[]) => void,
  ): void {
    if (
      dvItems.length !== 0 &&
      dvItems.find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    setter(this, this.loadingItems);

    const httpSubscription = this.dvObjectLookupService
      .getItems(
        this.collectionId ? this.collectionId! : '',
        objectType,
        undefined,
        this.dataverseToken,
      )
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            setter(this, items);
          } else {
            setter(this, []);
          }
          httpSubscription.unsubscribe();
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          setter(this, []);
        },
      });
  }

  // COLLECTIONS

  getCollectionOptions(): void {
    this.getDvObjectOptions(
      'Dataverse',
      this.collectionItems,
      this.setCollectionItems,
    );
  }

  setCollectionItems(
    comp: ConnectComponent,
    items: SelectItem<string>[],
  ): void {
    comp.collectionItems = items;
    comp.collectionId = undefined;
  }

  collectionOptionsHidden(): boolean {
    return this.pluginService.collectionOptionsHidden();
  }

  collectionFieldEditable(): boolean {
    return this.pluginService.collectionFieldEditable();
  }

  onCollectionChange() {
    this.doiItems = [];
    this.datasetId = undefined;
  }

  onCollectionSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.collectionItems = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.collectionItems = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.collectionSearchSubject.next(searchTerm);
  }

  async collectionSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        this.collectionId ? this.collectionId! : '',
        'Dataverse',
        searchTerm,
        this.dataverseToken,
      ),
    );
  }

  // DATASETS

  getDoiOptions(): void {
    this.getDvObjectOptions('Dataset', this.doiItems, this.setDoiItems);
  }

  setDoiItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    // Add "Create new dataset" option to the beginning of the list
    const createNewOption: SelectItem<string> = {
      label: '+ Create new dataset',
      value: 'CREATE_NEW_DATASET',
    };

    // Preserve an existing (restored) datasetId selection when coming back from Compare
    const existing = comp.datasetId;
    comp.doiItems = [createNewOption, ...items];

    if (existing && existing !== 'CREATE_NEW_DATASET') {
      // Ensure the existing selection is present in the list; if not, prepend it (after createNew option)
      if (!comp.doiItems.some((i) => i.value === existing)) {
        comp.doiItems = [
          createNewOption,
          { label: existing, value: existing },
          ...items,
        ];
      }
      // Leave comp.datasetId untouched so the selection stays visible
    } else {
      // Only reset if there was no prior selection
      comp.datasetId = undefined;
    }
  }

  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  // NEW DATASET

  createNewDatasetEnabled(): boolean {
    return this.pluginService.createNewDatasetEnabled();
  }

  newDataset() {
    const datasetId = `${this.collectionId ? this.collectionId! : ''}:${new_dataset}`;

    // Create the new dataset option
    const newDatasetOption: SelectItem<string> = {
      label: new_dataset,
      value: datasetId,
    };

    // Add it to the dropdown options if not already there
    const existingIndex = this.doiItems.findIndex(
      (item) => item.value === datasetId,
    );
    if (existingIndex === -1) {
      // Remove the "Create new dataset" option temporarily and add the actual new dataset
      const filteredItems = this.doiItems.filter(
        (item) => item.value !== 'CREATE_NEW_DATASET',
      );
      this.doiItems = [newDatasetOption, ...filteredItems];
    }

    this.datasetId = datasetId;
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
    const items = await firstValueFrom(
      this.dvObjectLookupService.getItems(
        this.collectionId ? this.collectionId! : '',
        'Dataset',
        searchTerm,
        this.dataverseToken,
      ),
    );

    // Add "Create new dataset" option to the beginning of results
    const createNewOption: SelectItem<string> = {
      label: '+ Create new dataset',
      value: 'CREATE_NEW_DATASET',
    };

    return [createNewOption, ...items];
  }

  onDatasetSelectionChange(event: { value: string }) {
    const selectedValue = event.value;

    if (selectedValue === 'CREATE_NEW_DATASET') {
      // Handle creation of new dataset
      this.newDataset();
      this.showNewDatasetCreatedMessage = true;

      // Hide the message after 3 seconds
      setTimeout(() => {
        this.showNewDatasetCreatedMessage = false;
      }, 3000);
    } else {
      this.showNewDatasetCreatedMessage = false;
    }
  }
}
