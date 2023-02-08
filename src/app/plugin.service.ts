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
    showDvToken: true,
    redirect_uri: '',
    plugins: [],
  };

  private allPlugins: Map<string, RepoPlugin> = new Map<string, RepoPlugin>();

  private defaultPlugin: RepoPlugin = {
    id: 'defaultPlugin',
    plugin: 'defaultPlugin',
    name: "Unknown repository type",
    pluginName: "Unknown plugin",
    parseSourceUrlField: false,
    repoNameFieldHasSearch: false,
    showTokenGetter: false,
  };

  constructor(private http: HttpClient) {
    this.setConfig();
  }

  private setConfig(): void {
    const subscr = this.http.get<Config>(`api/frontend/config`).subscribe(
      c => {
        this.config = c;
        this.config.plugins.forEach(p => {
          p.showTokenGetter = p.tokenGetter !== undefined && p.tokenGetter.URL !== undefined && p.tokenGetter.URL !== '';
          this.allPlugins.set(p.id, p);
          subscr.unsubscribe();
        });
      }
    );
  }

  getPlugins(): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    const added = new Set<string>();
    this.config.plugins.forEach(x => {
      if (!added.has(x.plugin)) {
        added.add(x.plugin);
        res.push({value: x.plugin, label: x.pluginName});
      }
    });
    return res;
  }

  getPluginIds(plugin?: string): SelectItem<string>[] {
    const res: SelectItem<string>[] = [];
    this.config.plugins.forEach(x => {
      if (x.plugin == plugin) {
        res.push({value: x.id, label: x.name});
      }
    });
    return res;
  }

  getPlugin(p?: string): RepoPlugin {
    let plugin: RepoPlugin | undefined;
    if (p !== undefined) {
      plugin = this.allPlugins.get(p);
    }
    if (plugin) {
      return plugin;
    }
    return this.defaultPlugin
  }

  dataverseHeader(): string {
    return this.config.dataverseHeader;
  }

  collectionOptionsHidden(): boolean {
    return this.config.collectionOptionsHidden;
  }

  createNewDatasetEnabled(): boolean {
    return this.config.createNewDatasetEnabled;
  }

  datasetFieldEditable(): boolean {
    return this.config.datasetFieldEditable;
  }

  collectionFieldEditable(): boolean {
    return this.config.collectionFieldEditable;
  }

  getExternalURL(): string {
    return this.config.externalURL;
  }

  showDVTokenGetter(): boolean {
    return this.config.showDvTokenGetter;
  }

  showDVToken(): boolean {
    return this.config.showDvToken;
  }

  isStoreDvToken(): boolean {
    const v = this.config.storeDvToken;
    return v === undefined ? false : v;
  }

  getRedirectUri(): string {
    return this.config.redirect_uri;
  }
}
