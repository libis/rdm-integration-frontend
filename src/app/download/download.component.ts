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
import { RepoLookupRequest } from '../models/repo-lookup';
import { RepoLookupService } from '../repo.lookup.service';
import { LoginState } from '../models/oauth';
import { OauthService } from '../oauth.service';
import { SubmitService } from '../submit.service';

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
    downloadRequested = false;

    // globus
    token?: string;
    repoNames: SelectItem<string>[] = [];
    repoName?: string;
    selectedRepoName?: string;
    foundRepoName?: string;
    repoSearchSubject: Subject<string> = new Subject();
    repoSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
    repoSearchResultsSubscription?: Subscription;
    branchItems: SelectItem<string>[] = [];
    option?: string;
    rootOptions: TreeNode<string>[] = [{ label: 'Expand and select', data: '', leaf: false, selectable: true }];
    selectedOption?: TreeNode<string>;
    optionsLoading = false;

    constructor(
        private dvObjectLookupService: DvObjectLookupService,
        private pluginService: PluginService,
        public dataService: DataService,
        public submit: SubmitService,
        private utils: UtilsService,
        private route: ActivatedRoute,
        private repoLookupService: RepoLookupService,
        private oauth: OauthService,
    ) {
        this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
            debounceTime(this.DEBOUNCE_TIME),
            map(searchText => this.datasetSearch(searchText)),
        );
        this.repoSearchResultsObservable = this.repoSearchSubject.pipe(
            debounceTime(this.DEBOUNCE_TIME),
            map(searchText => this.repoNameSearch(searchText)),
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
                const storedNonce = this.getNonce();
                const code = params['code'];
                if (code !== undefined) {
                    const loginState: LoginState = JSON.parse(params['state']);
                    if (storedNonce === loginState.nonce && code !== undefined) {
                        this.datasetId = loginState.datasetId?.value;
                        const tokenSubscription = this.oauth.getToken('globus', code, loginState.nonce).subscribe(x => {
                            this.token = x.session_id;
                            if (!this.pluginService.isStoreDvToken()) {
                                localStorage.removeItem("dataverseToken");
                            }
                            tokenSubscription.unsubscribe();
                        });
                    }
                } else if (storedNonce === null) {
                    this.getRepoToken();
                }
            });
        this.datasetSearchResultsSubscription = this.datasetSearchResultsObservable.subscribe({
            next: x => x.then(v => this.doiItems = v)
                .catch(err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }]),
            error: err => this.doiItems = [{ label: 'search failed: ' + err.message, value: err.message }],
        });
        this.repoSearchResultsSubscription = this.repoSearchResultsObservable.subscribe({
            next: x => x.then(v => this.repoNames = v)
                .catch(err => this.repoNames = [{ label: 'search failed: ' + err.message, value: err.message }]),
            error: err => this.repoNames = [{ label: 'search failed: ' + err.message, value: err.message }],
        });
    }

    ngOnDestroy() {
        this.datasetSearchResultsSubscription?.unsubscribe();
        this.repoSearchResultsSubscription?.unsubscribe();
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
                return 'background-color: #c3e6cb; color: black';
            case Fileaction.Custom:
                return 'background-color: #FFFAA0; color: black';
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
        return this.downloadRequested || !this.option || !Array.from(this.rowNodeMap.values()).some(x => x.data?.action === Fileaction.Download);
    }

    async download(): Promise<void> {
        const selected: Datafile[] = [];
        this.rowNodeMap.forEach(datafile => {
          if (datafile.data?.action === Fileaction.Download) {
            selected.push(datafile.data)
          }
        });
        this.downloadRequested = true;
        const httpSubscription = this.submit.download(selected, this.repoName, this.option, this.token, this.datasetId, this.token).subscribe({
            next: (submissionId) => {
                httpSubscription.unsubscribe();
                alert("download is requested and can be monitored in Dataverse UI: " + submissionId);
            },
            error: (err) => {
                httpSubscription.unsubscribe();
                alert(err);
            },
        });
    }

    // globus
    getRepoNameFieldName(): string | undefined {
        return this.pluginService.getPlugin('globus').repoNameFieldName;
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

    async repoNameSearch(searchTerm: string): Promise<SelectItem<string>[]> {
        const req = this.getRepoLookupRequest(true);
        if (req === undefined) {
            return [{ label: 'error', value: "error" }];
        }
        req.repoName = searchTerm;
        return await firstValueFrom(this.repoLookupService.search(req));
    }

    getRepoLookupRequest(isSearch: boolean): RepoLookupRequest | undefined {
        if (this.getRepoNameFieldName() && (this.getRepoName() === undefined || this.getRepoName() === '') && !isSearch) {
            alert(this.getRepoNameFieldName() + ' is missing');
            return;
        }
        if (this.branchItems.length !== 0 && this.branchItems.find(x => x === this.loadingItem) === undefined) {
            return;
        }
        this.branchItems = this.loadingItems;

        return {
            pluginId: 'globus',
            plugin: 'globus',
            repoName: this.getRepoName(),
            url: this.pluginService.getPlugin('globus').sourceUrlFieldValue,
            token: this.token,
        };
    }

    repoNameFieldEditable(): boolean {
        const v = this.pluginService.getPlugin('globus').repoNameFieldEditable;
        return v === undefined ? false : v;
    }

    getRepoNamePlaceholder(): string {
        const v = this.pluginService.getPlugin('globus').repoNameFieldPlaceholder;
        return v === undefined ? "" : v;
    }

    onRepoNameSearch(searchTerm: string | null) {
        if (searchTerm === null || searchTerm.length < 3) {
            this.repoNames = [{ label: 'start typing to search (at least three letters)', value: 'start' }];
            return;
        }
        this.repoNames = [{ label: 'searching "' + searchTerm + '"...', value: searchTerm }];
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
            this.repoNames = [{ label: 'start typing to search (at least three letters)', value: 'start' }];
        }
    }

    repoNameSearchInitEnabled(): boolean {
        return this.pluginService.getPlugin('globus').repoNameFieldHasInit!;
    }

    getOptionFieldName(): string | undefined {
        return this.pluginService.getPlugin('globus').optionFieldName;
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
                    items.forEach(i => nodes.push({ label: i.label, data: i.value, leaf: false, selectable: true }))
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
                alert("branch lookup failed: " + err.error);
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
        if (this.getRepoNameFieldName() === undefined) {
            this.repoName = undefined;
        }
    }

    getRepoToken() {
        if (this.dataverseToken !== undefined) {
            localStorage.setItem("dataverseToken", this.dataverseToken!);
        }
        const tg = this.pluginService.getPlugin('globus').tokenGetter;
        if (tg === undefined) {
            alert("globus plugin not found: " + this.pluginService.getPlugin('globus'));
            return;
        }
        let url = this.pluginService.getPlugin('globus').sourceUrlFieldValue + (tg.URL === undefined ? '' : tg.URL);
        if (tg.URL?.includes('://')) {
            url = tg.URL;
        }
        if (tg.oauth_client_id !== undefined && tg.oauth_client_id !== '') {
            const nonce = this.newNonce(44);
            const loginState: LoginState = {
                datasetId: { value: this.datasetId, label: this.datasetId },
                nonce: nonce,
            }
            let clId = '?client_id='
            if (url.includes("?")) {
                clId = '&client_id='
            }
            url = url + clId + encodeURIComponent(tg.oauth_client_id) +
                '&redirect_uri=' + this.getRedirectUri() +
                '&response_type=code&state=' + encodeURIComponent(JSON.stringify(loginState));
            location.href = url;
        } else {
            window.open(url, "_blank");
        }
    }

    getRedirectUri(): string {
        let redirect_uri = this.pluginService.getRedirectUri();
        if (redirect_uri.includes('#/connect')) {
            redirect_uri = redirect_uri.replace('#/connect', 'download');
        } else if (redirect_uri.includes('connect')) {
            redirect_uri = redirect_uri.replace('connect', 'download');
        } else if (redirect_uri.endsWith('/')) {
            redirect_uri = redirect_uri + 'download';
        } else {
            redirect_uri = redirect_uri + '/download';
        }
        return redirect_uri;
    }

    newNonce(length: number): string {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
            counter += 1;
        }
        localStorage.setItem("nonce", result);
        return result;
    }

    getNonce(): string | null {
        const result = localStorage.getItem("nonce");
        localStorage.removeItem("nonce");
        return result;
    }
}

