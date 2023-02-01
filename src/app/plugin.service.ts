// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Config, RepoPlugin } from './models/plugin';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  private config: Config = {
    dataverseHeader: "Unknown header: configuration failed",
    collectionOptionsHidden: true,
    createNewDatasetEnabled: false,
    datasetFieldEditable: false,
    collectionFieldEditable: false,
    externalURL: '',
    showDvTokenGetter: false,
    redirect_uri: '',
    plugins: [],
  };

  private pluginIds: SelectItem<string>[] = [];

  private allPlugins: Map<string, RepoPlugin> = new Map<string, RepoPlugin>();

  private defaultPlugin: RepoPlugin = {
    id: 'defaultPlugin',
    plugin: 'defaultPlugin',
    name: "Unknown repository type",
    sourceUrlFieldName: "Source URL",
    sourceUrlFieldPlaceholder: "URL",
    parseSourceUrlField: false,
    showTokenGetter: false,
  };

  constructor(private http: HttpClient) {
    this.setConfig();
  }

  private setConfig(): void {
    let subscr = this.http.get<Config>(`api/frontend/config`).subscribe(
      c => {
        this.config = c;
        this.config.plugins.forEach(p => {
          p.showTokenGetter = p.tokenGetter !== undefined && p.tokenGetter.URL !== undefined && p.tokenGetter.URL !== '';
          this.allPlugins.set(p.id, p);
          this.pluginIds.push({ label: p.name, value: p.id });
          subscr.unsubscribe();
        });
      }
    );
  }

  getRepoTypes(): SelectItem<string>[] {
    return [...this.pluginIds]
  }

  getPlugin(p?: string): RepoPlugin {
    var plugin: RepoPlugin | undefined;
    if (p !== undefined) {
      plugin = this.allPlugins.get(p);
    }
    if (plugin) {
      return plugin;
    }
    return this.defaultPlugin
  }

  dataverseHeader(): string {
    return this.config!.dataverseHeader;
  }

  collectionOptionsHidden(): boolean {
    return this.config!.collectionOptionsHidden;
  }

  createNewDatasetEnabled(): boolean {
    return this.config!.createNewDatasetEnabled;
  }

  datasetFieldEditable(): boolean {
    return this.config!.datasetFieldEditable;
  }

  collectionFieldEditable(): boolean {
    return this.config!.collectionFieldEditable;
  }

  getExternalURL(): string {
    return this.config!.externalURL;
  }

  showDVTokenGetter(): boolean {
    return this.config!.showDvTokenGetter;
  }

  isStoreDvToken(): boolean {
    let v = this.config!.storeDvToken;
    return v === undefined ? false : v;
  }

  getRedirectUri(): string {
    return this.config!.redirect_uri;
  }
}
