// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { ConnectValidationService } from '../shared/connect-validation.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';

// Models
import { Credentials } from '../models/credentials';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import { Item, LoginState } from '../models/oauth';
import { RepoLookupRequest } from '../models/repo-lookup';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionPanel,
} from 'primeng/accordion';
import { PrimeTemplate, SelectItem, TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { Tree } from 'primeng/tree';

// RxJS
import {
  Observable,
  Subject,
  debounceTime,
  filter,
  firstValueFrom,
  map,
  take,
} from 'rxjs';

// Constants and types
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { APP_CONSTANTS } from '../shared/constants';
import {
  convertToTreeNodes,
  createPlaceholderRootOptions,
} from '../shared/tree-utils';
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
    ProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConnectComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly router = inject(Router);
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
  private readonly navigation = inject(NavigationService);
  private readonly credentialsService = inject(CredentialsService);
  private readonly dataStateService = inject(DataStateService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  readonly repoNameSelect = viewChild.required<Select>('repoSelect');

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;
  readonly DOI_SELECT_WIDTH: SafeStyle =
    this.sanitizer.bypassSecurityTrustStyle('calc(100% - 12rem)');
  readonly NEW_DATASET = new_dataset;

  // NG MODEL SIGNALS
  readonly plugin = signal<string | undefined>(undefined);
  readonly pluginId = signal<string | undefined>(undefined);
  readonly user = signal<string | undefined>(undefined);
  readonly token = signal<string | undefined>(undefined);
  readonly sourceUrl = signal<string | undefined>(undefined);
  readonly repoName = signal<string | undefined>(undefined);
  readonly selectedRepoName = signal<string | undefined>(undefined);
  readonly foundRepoName = signal<string | undefined>(undefined);
  readonly option = signal<string | undefined>(undefined);
  readonly dataverseToken = signal<string | undefined>(undefined);
  readonly collectionId = signal<string | undefined>(undefined);
  readonly datasetId = signal<string | undefined>(undefined);

  // ITEMS IN SELECTS SIGNALS
  readonly loadingItem: SelectItem<string> = {
    label: `Loading...`,
    value: 'loading',
  };
  readonly loadingItems: SelectItem<string>[] = [this.loadingItem];

  readonly plugins = signal<SelectItem<string>[]>([]);
  readonly pluginIds = signal<SelectItem<string>[]>([]);
  readonly repoNames = signal<SelectItem<string>[]>([]);
  readonly branchItems = signal<HierarchicalSelectItem<string>[]>([]);
  readonly collectionItems = signal<SelectItem<string>[]>([]);
  readonly doiItems = signal<SelectItem<string>[]>([]);
  // Internal storage for tree nodes; use rootOptions() computed for reading
  private readonly _rootOptionsData = signal<TreeNode<string>[]>(
    createPlaceholderRootOptions(),
  );
  // Computed signal for template binding
  readonly rootOptions = computed(() => this._rootOptionsData());
  readonly selectedOption = signal<TreeNode<string> | undefined>(undefined);

  // Both accordion panels expanded by default
  readonly expandedPanels = signal<string[]>(['0', '1']);

  // INTERNAL STATE VARIABLES SIGNALS
  readonly url = signal<string | undefined>(undefined);
  readonly pluginIdSelectHidden = signal(true);
  readonly optionsLoading = signal(false);
  readonly showNewDatasetCreatedMessage = signal(false);
  // Computed Properties for UI - these must read all signals they depend on

  // OAuth/Token computed signals
  readonly hasOauthConfig = computed(() => {
    const pId = this.pluginId();
    if (pId === undefined) return false;
    return (
      this.pluginService.getPlugin(pId).tokenGetter?.oauth_client_id !==
      undefined
    );
  });

  readonly isAuthorized = computed(() => this.token() !== undefined);

  readonly showRepoTokenGetter = computed(() => {
    const pId = this.pluginId();
    if (pId === undefined) return false;
    return !!this.pluginService.getPlugin(pId).showTokenGetter;
  });

  // Repo name computed signals
  readonly repoNameFieldName = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    return this.pluginService.getPlugin(pId).repoNameFieldName;
  });

  readonly repoNamePlaceholder = computed(() => {
    const pId = this.pluginId();
    if (!pId) return '';
    const v = this.pluginService.getPlugin(pId).repoNameFieldPlaceholder;
    return v === undefined ? '' : v;
  });

  readonly repoNameFieldEditable = computed(() => {
    const pId = this.pluginId();
    if (!pId) return false;
    const v = this.pluginService.getPlugin(pId).repoNameFieldEditable;
    return v === undefined ? false : v;
  });

  readonly repoNameSearchEnabled = computed(() => {
    const pId = this.pluginId();
    if (!pId) return false;
    return !!this.pluginService.getPlugin(pId).repoNameFieldHasSearch;
  });

  readonly repoNameSearchInitEnabled = computed(() => {
    const pId = this.pluginId();
    if (!pId) return false;
    return !!this.pluginService.getPlugin(pId).repoNameFieldHasInit;
  });

  readonly computedRepoName = computed(() => {
    if (this.repoName() !== undefined) return this.repoName();
    if (this.selectedRepoName() !== undefined) return this.selectedRepoName();
    return this.foundRepoName();
  });

  // Plugin repo names computed signal
  readonly pluginRepoNames = computed(() => {
    const pId = this.pluginId();
    if (!pId) return [];
    const values = this.pluginService.getPlugin(pId).repoNameFieldValues;
    return values?.map((x) => ({ label: x, value: x })) ?? [];
  });

  // Option field computed signals
  readonly optionFieldName = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    return this.pluginService.getPlugin(pId).optionFieldName;
  });

  readonly optionPlaceholder = computed(() => {
    const pId = this.pluginId();
    if (!pId) return '';
    const v = this.pluginService.getPlugin(pId).optionFieldPlaceholder;
    return v === undefined ? '' : v;
  });

  readonly isOptionFieldInteractive = computed(() => {
    const pId = this.pluginId();
    if (!pId) return false;
    return !!this.pluginService.getPlugin(pId).optionFieldInteractive;
  });

  // Username field computed signals
  readonly usernameFieldName = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    return this.pluginService.getPlugin(pId).usernameFieldName;
  });

  readonly usernamePlaceholder = computed(() => {
    const pId = this.pluginId();
    if (!pId) return '';
    return this.pluginService.getPlugin(pId).usernameFieldPlaceholder ?? '';
  });

  // Token field computed signals
  readonly tokenFieldName = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    return this.pluginService.getPlugin(pId).tokenFieldName;
  });

  readonly tokenPlaceholder = computed(() => {
    const pId = this.pluginId();
    if (!pId) return '';
    return this.pluginService.getPlugin(pId).tokenFieldPlaceholder ?? '';
  });

  // Source URL computed signals
  readonly sourceUrlFieldName = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    return this.pluginService.getPlugin(pId).sourceUrlFieldName;
  });

  readonly sourceUrlPlaceholder = computed(() => {
    const pId = this.pluginId();
    if (!pId) return '';
    return this.pluginService.getPlugin(pId).sourceUrlFieldPlaceholder ?? '';
  });

  readonly sourceUrlValue = computed(() => {
    const pId = this.pluginId();
    if (!pId) return undefined;
    const res = this.pluginService.getPlugin(pId).sourceUrlFieldValue;
    return res !== undefined ? res : this.sourceUrl();
  });
  // Validation computed signal
  readonly missingFieldsTitle = computed(() => {
    return this.computedParseAndCheckFields() ?? 'Ready to connect';
  });

  readonly isConnectReady = computed(() => this.computedIsFormValid());
  readonly connectButtonClass = computed(() => {
    const baseClasses = 'p-button-sm p-button-raised';
    return this.isConnectReady()
      ? `${baseClasses} p-button-primary`
      : `${baseClasses} p-button-secondary`;
  });
  readonly showReset = computed(
    () =>
      !!(
        this.plugin() ||
        this.pluginId() ||
        this.user() ||
        this.token() ||
        this.repoName() ||
        this.selectedRepoName() ||
        this.foundRepoName() ||
        this.option() ||
        this.dataverseToken() ||
        this.collectionId() ||
        this.datasetId() ||
        this.sourceUrl()
      ),
  );

  // Computed signals for pluginService data
  readonly dataverseHeader = computed(() =>
    this.pluginService.dataverseHeader$(),
  );
  readonly showDVTokenGetter = computed(() =>
    this.pluginService.showDVTokenGetter$(),
  );
  readonly showDVToken = computed(() => this.pluginService.showDVToken$());
  readonly collectionOptionsHidden = computed(() =>
    this.pluginService.collectionOptionsHidden$(),
  );
  readonly collectionFieldEditable = computed(() =>
    this.pluginService.collectionFieldEditable$(),
  );
  readonly datasetFieldEditable = computed(() =>
    this.pluginService.datasetFieldEditable$(),
  );
  readonly createNewDatasetEnabled = computed(() =>
    this.pluginService.createNewDatasetEnabled$(),
  );
  readonly externalURL = computed(() => this.pluginService.externalURL$());

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

    // Load dataverseToken from localStorage if storeDvToken is enabled
    if (this.pluginService.isStoreDvToken()) {
      const dvToken = localStorage.getItem('dataverseToken');
      if (dvToken !== null) {
        this.dataverseToken.set(dvToken);
      }
    }

    this.repoSearchResultsSubscription =
      this.repoSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => {
              this.repoNames.set(v);
            })
            .catch((err) => {
              this.repoNames.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]);
            }),
        error: (err) => {
          this.repoNames.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]);
        },
      });
    this.collectionSearchResultsSubscription =
      this.collectionSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => {
              this.collectionItems.set(v);
            })
            .catch((err) => {
              this.collectionItems.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]);
            }),
        error: (err) => {
          this.collectionItems.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]);
        },
      });
    const queryParamsSubscription = this.route.queryParams.subscribe(
      (params) => {
        this.handleQueryParams(params);
      },
    );
    this.subscriptions.add(queryParamsSubscription);
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
      this.plugin.set(undefined);
      this.pluginId.set(undefined);
      this.user.set(undefined);
      this.token.set(undefined);
      this.repoName.set(undefined);
      this.selectedRepoName.set(undefined);
      this.foundRepoName.set(undefined);
      this.option.set(undefined);
      this.collectionId.set(undefined); // allow explicit collectionId if later provided
      this.plugins.set([]);
      this.pluginIds.set([]);
      this.repoNames.set([]);
      this.branchItems.set([]);
      this.collectionItems.set([]);
      this.doiItems.set([]);
    }
    const datasetPid = params['datasetPid'];
    if (datasetPid) {
      this.ensureSelectContains(this.doiItems(), datasetPid, (items) =>
        this.doiItems.set(items),
      );
      // Explicit deep link should override any previously restored dataset id
      this.datasetId.set(datasetPid);
    }
    const apiToken = params['apiToken'];
    if (apiToken) {
      this.dataverseToken.set(apiToken);
    }
    // Note: callback parameter is now handled by AppComponent which parses it
    // and redirects to /connect with datasetPid already resolved
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
    // Download flows with state.download are normally caught by AppComponent
    // and routed to /download. This is a fallback for edge cases.
    if (loginState.download) {
      this.router.navigate(['/download'], { queryParams: params });
      return;
    }
    this.sourceUrl.set(loginState.sourceUrl);
    this.url.set(loginState.url);
    this.repoName.set(loginState.repoName);
    this.selectedRepoName.set(loginState.repoName);
    this.foundRepoName.set(loginState.repoName);
    this.user.set(loginState.user);

    if (loginState.plugin?.value) {
      this.plugins.set([
        { label: loginState.plugin.label, value: loginState.plugin.value! },
      ]);
      this.plugin.set(loginState.plugin.value);
    }
    if (loginState.pluginId?.value) {
      this.pluginIds.set([
        { label: loginState.pluginId.label, value: loginState.pluginId.value! },
      ]);
      this.pluginId.set(loginState.pluginId.value);
      this.pluginIdSelectHidden.set(!!loginState.pluginId.hidden);
    } else {
      this.pluginIdSelectHidden.set(true);
    }
    if (loginState.option?.value) {
      this.branchItems.set([
        { label: loginState.option.label, value: loginState.option.value! },
        this.loadingItem,
      ]);
      this.option.set(loginState.option.value);
    }
    if (loginState.datasetId?.value) {
      this.ensureSelectContains(
        this.doiItems(),
        loginState.datasetId.value,
        (items) => this.doiItems.set(items),
      );
      this.datasetId.set(loginState.datasetId.value);
    }
    if (loginState.collectionId?.value) {
      this.ensureSelectContains(
        this.collectionItems(),
        loginState.collectionId.value,
        (items) => this.collectionItems.set(items),
      );
      this.collectionId.set(loginState.collectionId.value);
    }
    const code = params['code'];
    const pId = this.pluginId();
    if (loginState.nonce && pId && code) {
      const tokenSubscription = this.oauth
        .getToken(pId, code, loginState.nonce)
        .subscribe((x) => {
          this.token.set(x.session_id);
          this.subscriptions.delete(tokenSubscription);
          tokenSubscription?.unsubscribe();
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
          datasetId: this.datasetId(),
          collectionId: this.collectionId(),
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
          datasetId: this.datasetId(),
          collectionId: this.collectionId(),
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
      setter: (v: T | undefined) => void,
    ) => {
      if (current === undefined && incoming !== undefined) {
        setter(incoming);
      }
    };

    assignIfEmpty(this.plugin(), snap.plugin, (v) => this.plugin.set(v));
    assignIfEmpty(this.pluginId(), snap.pluginId, (v) => this.pluginId.set(v));
    assignIfEmpty(this.user(), snap.user, (v) => this.user.set(v));
    assignIfEmpty(this.token(), snap.token, (v) => this.token.set(v));
    assignIfEmpty(this.repoName(), snap.repo_name, (v) => this.repoName.set(v));
    assignIfEmpty(this.selectedRepoName(), snap.repo_name, (v) =>
      this.selectedRepoName.set(v),
    );
    assignIfEmpty(this.foundRepoName(), snap.repo_name, (v) =>
      this.foundRepoName.set(v),
    );
    assignIfEmpty(this.option(), snap.option, (v) => this.option.set(v));
    assignIfEmpty(this.dataverseToken(), snap.dataverse_token, (v) =>
      this.dataverseToken.set(v),
    );

    // Dataset precedence logic:
    if (!this.datasetId()) {
      const snapId = (snap as Record<string, unknown>)['id'];
      const newVal =
        datasetFromNav ||
        snap.dataset_id ||
        (typeof snapId === 'string' ? snapId : undefined) ||
        this.datasetId();
      this.datasetId.set(newVal);
    }
    // Collection similar precedence; do not overwrite existing selection.
    if (!this.collectionId()) {
      const snapCollection = (snap as Record<string, unknown>)['collectionId'];
      const newVal =
        collectionFromNav ||
        (typeof snapCollection === 'string' ? snapCollection : undefined) ||
        this.collectionId();
      this.collectionId.set(newVal);
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
    ensureList(this.plugins(), this.plugin(), (i) => this.plugins.set(i));
    ensureList(this.pluginIds(), this.pluginId(), (i) => this.pluginIds.set(i));
    ensureList(this.repoNames(), this.repoName(), (i) => this.repoNames.set(i));
    ensureList(this.branchItems(), this.option(), (i) =>
      this.branchItems.set(i),
    );
    ensureList(this.doiItems(), this.datasetId(), (i) => this.doiItems.set(i));
    ensureList(this.collectionItems(), this.collectionId(), (i) =>
      this.collectionItems.set(i),
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
    if (!this.datasetId()) this.restoreFromStorage();
    if (RESTORE_TRACE) {
      try {
        // eslint-disable-next-line no-console
        console.debug('[RESTORE-TRACE] attemptFullRestore end', {
          datasetId: this.datasetId(),
          collectionId: this.collectionId(),
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

  getRepoToken(scopes?: string) {
    const pId = this.pluginId();
    if (pId === undefined) {
      this.notificationService.showError('Repository type is missing');
      return;
    }
    const tg = this.pluginService.getPlugin(pId).tokenGetter!;
    let url = this.url() + (tg.URL === undefined ? '' : tg.URL);
    if (tg.URL?.includes('://')) {
      url = tg.URL;
    }
    if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
      const nonce = this.newNonce(44);
      const pluginIdItem = this.getItem(this.pluginIds(), pId);
      if (pluginIdItem !== undefined) {
        pluginIdItem.hidden = this.pluginIdSelectHidden();
      }
      const loginState: LoginState = {
        sourceUrl: this.sourceUrl(),
        url: this.url(),
        plugin: this.getItem(this.plugins(), this.plugin()),
        pluginId: pluginIdItem,
        repoName: this.computedRepoName(),
        user: this.user(),
        option: this.getItem(this.branchItems(), this.option()),
        datasetId: this.getItem(this.doiItems(), this.datasetId()),
        collectionId: this.getItem(this.collectionItems(), this.collectionId()),
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
      this.navigation.assign(url);
    } else {
      const curUrl = this.url();
      if (curUrl) window.open(curUrl, '_blank');
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

  /***********
   * CONNECT *
   ***********/

  async connect() {
    let subscr: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    subscr = this.http
      .post<string>('api/common/useremail', this.dataverseToken())
      .subscribe({
        next: (useremail) => {
          subscr?.unsubscribe();
          if (useremail !== '') {
            const err = this.parseAndCheckFields();
            if (err !== undefined) {
              this.notificationService.showError(err);
              return;
            }
            const pId = this.pluginId();
            if (!pId) return;

            const tokenName = this.pluginService.getPlugin(pId).tokenName;
            const token = this.token();
            if (
              token !== undefined &&
              tokenName !== undefined &&
              tokenName !== ''
            ) {
              localStorage.setItem(tokenName, token);
            }
            const creds: Credentials = {
              pluginId: pId,
              plugin: this.plugin(),
              repo_name: this.computedRepoName(),
              url: this.url(),
              option: this.option(),
              user: this.user(),
              token: token,
              dataset_id: this.datasetId(),
              // New dataset detection must work even when a collection prefix is included
              newly_created: this.isNewDatasetId(this.datasetId()),
              dataverse_token: this.dataverseToken(),
            };
            // Persist snapshot BEFORE navigating
            this.snapshotStorage.saveConnect({
              plugin: this.plugin(),
              pluginId: pId,
              user: this.user(),
              token: token,
              repo_name: this.computedRepoName(),
              url: this.url(),
              option: this.option(),
              dataverse_token: this.dataverseToken(),
              dataset_id: this.datasetId(),
              collectionId: this.collectionId(),
            });
            this.dataStateService.resetState();
            this.credentialsService.setCredentials(creds);

            this.router.navigate(['/compare', this.datasetId()], {
              state: {
                collectionId: this.collectionId(),
                collectionItems: this.collectionItems(),
              },
            });
          } else {
            this.notificationService.showError(
              'Unknown user: you need to generate a valid Dataverse API token first',
            );
          }
        },
        error: (err) => {
          subscr?.unsubscribe();
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
    this.plugin.set(undefined);
    this.pluginId.set(undefined);
    this.user.set(undefined);
    this.token.set(undefined);
    this.repoName.set(undefined);
    this.selectedRepoName.set(undefined);
    this.foundRepoName.set(undefined);
    this.option.set(undefined);
    this.dataverseToken.set(undefined);
    this.collectionId.set(undefined);
    this.datasetId.set(undefined);
    this.plugins.set([]);
    this.pluginIds.set([]);
    this.repoNames.set([]);
    this.branchItems.set([]);
    this.collectionItems.set([]);
    this.doiItems.set([]);
    this._rootOptionsData.set(createPlaceholderRootOptions());
    this.selectedOption.set(undefined);
    this.expandedPanels.set(['0', '1']);
  }

  private buildValidationContext() {
    return {
      pluginId: this.pluginId(),
      datasetId: this.datasetId(),
      sourceUrl: this.sourceUrl(),
      token: this.token(),
      option: this.option(),
      user: this.user(),
      repoName: this.computedRepoName(),
      getSourceUrlFieldName: () => this.sourceUrlFieldName(),
      getTokenFieldName: () => this.tokenFieldName(),
      getOptionFieldName: () => this.optionFieldName(),
      getUsernameFieldName: () => this.usernameFieldName(),
      getRepoNameFieldName: () => this.repoNameFieldName(),
      parseUrl: () => this.validateUrl(), // Use validateUrl (pure, no signal writes) for validation
    };
  }

  /** Computed version of isFormValid for use in computed signals */
  private computedIsFormValid(): boolean {
    return this.connectValidation.isValid(this.buildValidationContext());
  }

  /** Computed version of parseAndCheckFields for use in computed signals */
  private computedParseAndCheckFields(): string | undefined {
    const issues = this.connectValidation.gatherIssues(
      this.buildValidationContext(),
    );
    return this.connectValidation.summarizeIssues(issues);
  }

  parseAndCheckFields(): string | undefined {
    const issues = this.connectValidation.gatherIssues(
      this.buildValidationContext(),
    );
    return this.connectValidation.summarizeIssues(issues);
  }

  /**
   * Checks if all required fields are valid without returning error messages
   * Used for reactive validation to determine button state
   */
  isFormValid(): boolean {
    return this.connectValidation.isValid(this.buildValidationContext());
  }

  /**
   * Validates the URL format and returns an error message if invalid.
   * This is a pure function that does NOT write to signals - safe for use in computed signals.
   */
  validateUrl(): string | undefined {
    const pId = this.pluginId();
    if (!pId) return;
    if (!this.pluginService.getPlugin(pId).parseSourceUrlField) {
      return;
    }
    const sUrl = this.sourceUrl();
    if (!sUrl) {
      return 'Malformed source url';
    }
    let toSplit = sUrl!;
    if (toSplit.endsWith('/')) {
      toSplit = toSplit.substring(0, toSplit.length - 1);
    }
    const splitted = toSplit.split('://');
    if (splitted?.length == 2) {
      const pathParts = splitted[1].split('/');
      if (pathParts?.length <= 2) {
        return 'Malformed source url';
      }
    } else {
      return 'Malformed source url';
    }
    return;
  }

  /**
   * Parses the URL and updates the url and repoName signals.
   * Should only be called from effects or event handlers, NOT from computed signals.
   */
  parseUrl(): string | undefined {
    const pId = this.pluginId();
    if (!pId) return;
    if (!this.pluginService.getPlugin(pId).parseSourceUrlField) {
      this.url.set(this.sourceUrlValue());
      return;
    }
    const sUrl = this.sourceUrl();
    if (!sUrl) {
      return 'Malformed source url';
    }
    let toSplit = sUrl!;
    if (toSplit.endsWith('/')) {
      toSplit = toSplit.substring(0, toSplit.length - 1);
    }
    let splitted = toSplit.split('://');
    if (splitted?.length == 2) {
      splitted = splitted[1].split('/');
      if (splitted?.length > 2) {
        this.url.set(`https://${splitted[0]}`);
        let rName = splitted.slice(1, splitted.length).join('/');
        if (rName.endsWith('.git')) {
          rName = rName.substring(0, rName.length - 4);
        }
        this.repoName.set(rName);
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
    this.plugins.set(this.pluginService.getPlugins());
  }

  changePlugin() {
    const pluginIds = this.pluginService.getPluginIds(this.plugin());
    if (pluginIds.length === 1) {
      this.pluginId.set(pluginIds[0].value);
    } else {
      this.pluginId.set(undefined);
    }
    this.pluginIdSelectHidden.set(pluginIds.length < 2);
    this.changePluginId();
  }

  getPluginIds() {
    this.pluginIds.set(this.pluginService.getPluginIds(this.plugin()));
  }

  changePluginId() {
    this.token.set(undefined);
    const pId = this.pluginId();
    if (pId) {
      const tokenName = this.pluginService.getPlugin(pId).tokenName;
      if (tokenName !== undefined && tokenName !== '') {
        const token = localStorage.getItem(tokenName);
        if (token !== null) {
          this.token.set(token);
        }
      }
    }

    this.sourceUrl.set(undefined);
    this.branchItems.set([]);
    this.option.set(undefined);
    this.url.set(undefined);
    this.user.set(undefined);
    this.repoNames.set([]);
    this.repoName.set(undefined);
    this.selectedRepoName.set(undefined);
    this.foundRepoName.set(undefined);
  }

  /**************
   * REPOSITORY *
   **************/

  // REPO CHOICE: COMMON

  getRepoLookupRequest(isSearch: boolean): RepoLookupRequest | undefined {
    const pId = this.pluginId();
    if (pId === undefined) {
      this.notificationService.showError('Repository type is missing');
      return;
    }
    const err = this.parseUrl();
    if (err) {
      this.notificationService.showError(err);
      return;
    }
    const url = this.url();
    if (url === undefined || url === '') {
      this.notificationService.showError('URL is missing');
      return;
    }
    const user = this.user();
    if (this.usernameFieldName() && (user === undefined || user === '')) {
      this.notificationService.showError(
        `${this.usernameFieldName()} is missing`,
      );
      return;
    }
    if (
      this.repoNameFieldName() &&
      (this.computedRepoName() === undefined ||
        this.computedRepoName() === '') &&
      !isSearch
    ) {
      this.notificationService.showError(
        `${this.repoNameFieldName()} is missing`,
      );
      return;
    }
    const token = this.token();
    if (this.tokenFieldName() && (token === undefined || token === '')) {
      this.notificationService.showError(`${this.tokenFieldName()} is missing`);
      return;
    }
    if (
      this.branchItems().length !== 0 &&
      this.branchItems().find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }

    this.branchItems.set(this.loadingItems);

    return {
      pluginId: pId,
      plugin: this.plugin(),
      repoName: this.computedRepoName(),
      url: url,
      user: user,
      token: token,
    };
  }

  onRepoChange() {
    this.branchItems.set([]);
    this.option.set(undefined);
    this.url.set(undefined);
    if (this.repoNameFieldName() === undefined) {
      this.repoName.set(undefined);
    }
  }

  // REPO VIA SEARCH

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
      this.repoNames.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.repoNames.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.repoSearchSubject.next(searchTerm);
  }

  startRepoSearch() {
    if (this.foundRepoName() !== undefined) {
      return;
    }
    if (this.repoNameSearchInitEnabled()) {
      this.repoNames.set([{ label: 'loading...', value: 'start' }]);
      this.repoSearchSubject.next('');
    } else {
      this.repoNames.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
    }
  }

  // REPO VIA SELECT

  showRepoName() {
    this.repoNameSelect().show();
  }

  // BRANCHES/FOLDERS/OTHER OPTIONS

  getOptions(node?: TreeNode<string>): void {
    const req = this.getRepoLookupRequest(false);
    if (req === undefined) {
      return;
    }
    if (node) {
      req.option = node.data;
      this.optionsLoading.set(true);
    }

    this.repoLookupService
      .getOptions(req)
      .pipe(take(1))
      .subscribe({
        next: (items: HierarchicalSelectItem<string>[]) => {
          this.handleOptionsResponse(items, node);
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
            this.branchItems.set([]);
            this.option.set(undefined);
            this.optionsLoading.set(false);
          }
        },
      });
  }

  /**
   * Handle response from options lookup API.
   * Builds tree from items and auto-selects if backend marked a node.
   */
  private handleOptionsResponse(
    items: HierarchicalSelectItem<string>[],
    node?: TreeNode<string>,
  ): void {
    if (items && node) {
      // Expanding an existing node - add children
      const nodes = convertToTreeNodes(items);
      node.children = nodes.treeNodes;
      // Create new array reference so PrimeNG p-tree detects the change
      this._rootOptionsData.update((prev) => [...prev]);
      this.optionsLoading.set(false);
      this.autoSelectNode(nodes.selectedNode);
    } else if (items && items.length > 0) {
      // Initial load - convert items directly (backend returns from appropriate starting point)
      const nodes = convertToTreeNodes(items);
      this._rootOptionsData.set(nodes.treeNodes);
      this.branchItems.set(items);
      this.autoSelectNode(nodes.selectedNode);
    } else {
      this.branchItems.set([]);
    }
  }

  /**
   * Auto-select node if backend marked it as selected.
   */
  private autoSelectNode(selectedNode?: TreeNode<string>): void {
    if (selectedNode) {
      this.option.set(selectedNode.data);
      this.selectedOption.set(selectedNode);
    }
  }

  optionSelected(node: TreeNode<string>): void {
    const v = node.data;
    if (v === undefined || v === null) {
      this.selectedOption.set(undefined);
      this.option.set(undefined);
    } else {
      // Allow selecting root "/" or any other folder
      this.option.set(v);
      this.selectedOption.set(node);
    }
  }

  /****************************************
   * DATAVERSE: DATASET CHOICE AND OPTIONS*
   ****************************************/

  // DATAVERSE API TOKEN

  getDataverseToken(): void {
    const url = `${this.externalURL()}/dataverseuser.xhtml?selectTab=apiTokenTab`;
    window.open(url, '_blank');
  }

  onUserChange() {
    this.doiItems.set([]);
    this.collectionItems.set([]);
    this.datasetId.set(undefined);
    this.collectionId.set(undefined);
    // Save dataverseToken to localStorage if storeDvToken is enabled
    if (
      this.dataverseToken() !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken()!);
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
    const lItems = this.loadingItems;
    setter(this, lItems);

    const httpSubscription = this.dvObjectLookupService
      .getItems(
        this.collectionId() ? this.collectionId()! : '',
        objectType,
        undefined,
        this.dataverseToken(),
      )
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            setter(this, items);
          } else {
            setter(this, []);
          }
          httpSubscription?.unsubscribe();
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
      this.collectionItems(),
      this.setCollectionItems,
    );
  }

  setCollectionItems(
    comp: ConnectComponent,
    items: SelectItem<string>[],
  ): void {
    comp.collectionItems.set(items);
    comp.collectionId.set(undefined);
  }

  onCollectionChange() {
    this.doiItems.set([]);
    this.datasetId.set(undefined);
  }

  onCollectionSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.collectionItems.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.collectionItems.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.collectionSearchSubject.next(searchTerm);
  }

  async collectionSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        this.collectionId() ? this.collectionId()! : '',
        'Dataverse',
        searchTerm,
        this.dataverseToken(),
      ),
    );
  }

  // DATASETS

  getDoiOptions(): void {
    this.getDvObjectOptions('Dataset', this.doiItems(), this.setDoiItems);
  }

  setDoiItems(comp: ConnectComponent, items: SelectItem<string>[]): void {
    // Add "Create new dataset" option to the beginning of the list
    const createNewOption: SelectItem<string> = {
      label: '+ Create new dataset',
      value: 'CREATE_NEW_DATASET',
    };

    // Preserve an existing (restored) datasetId selection when coming back from Compare
    const existing = comp.datasetId();
    comp.doiItems.set([createNewOption, ...items]);

    if (existing && existing !== 'CREATE_NEW_DATASET') {
      // Ensure the existing selection is present in the list; if not, prepend it (after createNew option)
      if (!comp.doiItems().some((i) => i.value === existing)) {
        comp.doiItems.set([
          createNewOption,
          { label: existing, value: existing },
          ...items,
        ]);
      }
      // Leave comp.datasetId untouched so the selection stays visible
    } else {
      // Only reset if there was no prior selection
      comp.datasetId.set(undefined);
    }
  }

  // NEW DATASET

  newDataset() {
    const datasetId = `${this.collectionId() ? this.collectionId()! : ''}:${new_dataset}`;

    // Create the new dataset option
    const newDatasetOption: SelectItem<string> = {
      label: new_dataset,
      value: datasetId,
    };

    // Add it to the dropdown options if not already there
    const existingIndex = this.doiItems().findIndex(
      (item) => item.value === datasetId,
    );
    if (existingIndex === -1) {
      // Remove the "Create new dataset" option temporarily and add the actual new dataset
      const filteredItems = this.doiItems().filter(
        (item) => item.value !== 'CREATE_NEW_DATASET',
      );
      this.doiItems.set([newDatasetOption, ...filteredItems]);
    }

    this.datasetId.set(datasetId);
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.doiItems.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    const items = await firstValueFrom(
      this.dvObjectLookupService.getItems(
        this.collectionId() ? this.collectionId()! : '',
        'Dataset',
        searchTerm,
        this.dataverseToken(),
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
      this.showNewDatasetCreatedMessage.set(true);

      // Hide the message after 3 seconds
      setTimeout(() => {
        this.showNewDatasetCreatedMessage.set(false);
      }, 3000);
    } else {
      this.showNewDatasetCreatedMessage.set(false);
    }
  }
}
