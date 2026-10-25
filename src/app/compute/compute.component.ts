// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { CdkScrollable } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

// Services
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';

// Models
import {
  CachedComputeResponse,
  CompareResult,
  ComputeRequest,
  Key,
} from '../models/compare-result';
import { Datafile } from '../models/datafile';

// UI
import { FormsModule } from '@angular/forms';
import { TreeNode } from '../models/tree-node';
import { SelectItem } from '../models/select-item';
import { DialogComponent } from '../shared/ui/dialog/dialog.component';
import { SelectComponent } from '../shared/ui/select/select.component';
import { TreeTableComponent } from '../shared/ui/tree-table/tree-table.component';
import {
  TreeTableHeaderDirective,
  TreeTableRowDirective,
} from '../shared/ui/tree-table/tree-table-templates';

// Components
import { ExecutablefileComponent } from '../executablefile/executablefile.component';

// Third-party
import { AutosizeModule } from 'ngx-autosize';

// RxJS
import {
  debounceTime,
  firstValueFrom,
  map,
  Observable,
  Subject,
  take,
} from 'rxjs';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-compute',
  // The host scrolls when the window is small (fill-window in
  // _page-layout.scss): open select and filter panels follow it.
  hostDirectives: [CdkScrollable],
  templateUrl: './compute.component.html',
  styleUrl: './compute.component.scss',
  imports: [
    FormsModule,
    SelectComponent,
    DialogComponent,
    TreeTableComponent,
    TreeTableHeaderDirective,
    TreeTableRowDirective,
    ExecutablefileComponent,
    AutosizeModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComputeComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  private readonly pluginService = inject(PluginService);
  private readonly dataService = inject(DataService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  private readonly navigation = inject(NavigationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // Icon constants
  readonly icon_play = APP_CONSTANTS.ICONS.PLAY;

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS (signals)
  readonly dataverseToken = signal<string | undefined>(undefined);
  readonly datasetId = signal<string | undefined>(undefined);
  readonly output = signal('');
  readonly data = signal<CompareResult>({});
  readonly rootNodeChildren = signal<TreeNode<Datafile>[]>([]);
  readonly rowNodeMap = signal<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly loading = signal(false);
  readonly popup = signal(false);
  readonly outputDisabled = signal(true);
  readonly sendEmailOnSuccess = signal(false);

  // ITEMS IN SELECTS
  readonly loadingItem: SelectItem<string> = {
    label: `Loading...`,
    value: 'loading',
  };
  readonly loadingItems: SelectItem<string>[] = [this.loadingItem];
  readonly doiItems = signal<SelectItem<string>[]>([]);

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  req?: ComputeRequest;
  /** The file listing of the dataset last picked. */
  private listingSubscription?: Subscription;

  // Direct references to pluginService signals (no wrapper computed needed)
  readonly showDVToken = this.pluginService.showDVToken$;
  readonly datasetFieldEditable = this.pluginService.datasetFieldEditable$;
  readonly dataverseHeader = this.pluginService.dataverseHeader$;
  readonly sendMails = this.pluginService.sendMails$;
  readonly configLoaded = this.pluginService.configLoaded$;

  constructor() {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );
  }

  async ngOnInit() {
    // Load dataverseToken from localStorage if storeDvToken is enabled
    if (this.pluginService.isStoreDvToken()) {
      const dvToken = localStorage.getItem('dataverseToken');
      if (dvToken !== null) {
        this.dataverseToken.set(dvToken);
      }
    }

    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        const pid = params['datasetPid'];
        if (pid) {
          this.doiItems.set([{ label: pid, value: pid }]);
          this.datasetId.set(pid);
        }
        const apiToken = params['apiToken'];
        if (apiToken) {
          this.dataverseToken.set(apiToken);
        }
      }),
    );
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => this.doiItems.set(v))
            .catch((err) =>
              this.doiItems.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]),
            ),
        error: (err) =>
          this.doiItems.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();

    // Clean up existing observable subscriptions
    this.datasetSearchResultsSubscription?.unsubscribe();
  }

  back(): void {
    this.navigation.assign('connect');
  }

  // The token before an edit of the field, kept from the first input event of
  // the edit to the change event that commits it.
  private tokenBeforeEdit?: { value: string | undefined };

  onTokenInput(value: string | undefined): void {
    this.tokenBeforeEdit ??= { value: this.dataverseToken() };
    this.dataverseToken.set(value);
  }

  onUserChange() {
    // A commit that leaves the token as it was, a browser filling in the
    // same token again for instance, changes nothing.
    const before = this.tokenBeforeEdit;
    this.tokenBeforeEdit = undefined;
    if (before === undefined || before.value === this.dataverseToken()) {
      return;
    }
    // A file listing for the old token would only keep the spinner going.
    if (this.listingSubscription && !this.listingSubscription.closed) {
      this.listingSubscription.unsubscribe();
      this.loading.set(false);
    }
    this.doiItems.set([]);
    this.datasetId.set(undefined);
    // The rows of the old dataset go with it, so nothing runs without one.
    this.data.set({});
    this.rootNodeChildren.set([]);
    this.rowNodeMap.set(new Map<string, TreeNode<Datafile>>());
    // Save dataverseToken to localStorage if storeDvToken is enabled
    if (
      this.dataverseToken() !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken()!);
    }
  }

  // DV OBJECTS: COMMON

  getDoiOptions(): void {
    if (
      this.doiItems().length !== 0 &&
      this.doiItems().find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.doiItems.set(this.loadingItems);
    this.datasetId.set(undefined);

    // take(1) ends the request with its answer, also a synchronous one.
    this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken())
      .pipe(take(1))
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems.set(items);
            this.datasetId.set(undefined);
          } else {
            this.doiItems.set([]);
            this.datasetId.set(undefined);
          }
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems.set([]);
          this.datasetId.set(undefined);
        },
      });
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
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken(),
      ),
    );
  }

  onDatasetChange() {
    const datasetId = this.datasetId();
    this.loading.set(true);
    this.output.set('');
    this.outputDisabled.set(true);
    // take(1) ends the request with its answer, also a synchronous one.
    this.listingSubscription = this.dataService
      .getExecutableFiles(datasetId!, this.dataverseToken())
      .pipe(take(1))
      .subscribe({
        next: (data) => {
          // A listing for a dataset that is no longer selected changes
          // nothing; the listing of the selected one ends the spinner.
          if (this.datasetId() !== datasetId) return;
          this.setData(data);
        },
        error: (err) => {
          if (this.datasetId() !== datasetId) return;
          this.loading.set(false);
          this.notificationService.showError(
            `Getting executable files failed: ${err.error}`,
          );
        },
      });
  }

  setData(data: CompareResult): void {
    this.data.set(data);
    if (!data.data || data.data.length === 0) {
      this.loading.set(false);
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap.set(rowDataMap);
    if (rootNode?.children) {
      this.rootNodeChildren.set(rootNode.children);
    }
    this.loading.set(false);
  }

  submitCompute(req: ComputeRequest): void {
    this.req = req;
    this.popup.set(true);
  }

  continueSubmit() {
    this.popup.set(false);
    this.loading.set(true);
    this.req!.sendEmailOnSuccess = this.sendEmailOnSuccess();
    let httpSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    httpSubscription = this.dataService.compute(this.req!).subscribe({
      next: (key: Key) => {
        httpSubscription?.unsubscribe();
        this.getComputeData(key);
      },
      error: (err: { error?: unknown; message?: string }) => {
        httpSubscription?.unsubscribe();
        this.loading.set(false);
        // The backend answers with the error as text; without it (a network
        // error) the message of the HTTP error says what failed.
        const text =
          typeof err?.error === 'string' && err.error !== ''
            ? err.error
            : (err?.message ?? 'unknown error');
        this.notificationService.showError(`Compute request failed: ${text}`);
      },
    });
  }

  private getComputeData(key: Key): void {
    let subscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    subscription = this.dataService.getCachedComputeData(key).subscribe({
      next: async (res: CachedComputeResponse) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        if (res.ready === true) {
          this.loading.set(false);
          if (res.res) {
            this.output.set(res.res);
          }
          if (res.err && res.err !== '') {
            this.notificationService.showError(res.err);
          } else {
            this.outputDisabled.set(false);
          }
        } else {
          if (res.res) {
            this.output.set(res.res);
          }
          await this.utils.sleep(1000);
          this.getComputeData(key);
        }
      },
      error: (err) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        this.loading.set(false);
        this.notificationService.showError(
          `Getting computation results failed: ${err.error}`,
        );
      },
    });
    this.subscriptions.add(subscription);
  }
}
