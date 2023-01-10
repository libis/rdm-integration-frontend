import { Injectable } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { RepoPlugin } from './models/plugin';

@Injectable({
  providedIn: 'root'
})
export class PluginService {

  private allPlugins: Map<string, RepoPlugin> = new Map<string, RepoPlugin>([
    ["github", {
      name: "GitHub",
      optionFieldName: "Branch",
      tokenFieldName: "Token",
      sourceUrlFieldPlaceholder: "https://github.com/<owner>/<repository>",
      tokenFieldPlaceholder: "Repository API token",
      usernameFieldHidden: true,
      zoneFieldHidden: true,
      parseSourceUrlField: true,
      getToken() { return localStorage.getItem('ghToken') },
      setToken(token: string | undefined) { if (token) localStorage.setItem('ghToken', token) },
    }],
    ["gitlab", {
      name: "GitLab",
      optionFieldName: "Branch",
      tokenFieldName: "Token",
      sourceUrlFieldPlaceholder: "https://gitlab.kuleuven.be/<group>/<project>",
      tokenFieldPlaceholder: "Repository API token",
      usernameFieldHidden: true,
      zoneFieldHidden: true,
      parseSourceUrlField: true,
      getToken() { return localStorage.getItem('glToken') },
      setToken(token: string | undefined) { if (token) localStorage.setItem('glToken', token) },
    }],
    ["irods", {
      name: "IRODS",
      optionFieldName: "Folder",
      tokenFieldName: "Token (IRODS password)",
      sourceUrlFieldPlaceholder: "Hostname",
      tokenFieldPlaceholder: "Password",
      usernameFieldHidden: false,
      zoneFieldHidden: false,
      parseSourceUrlField: false,
      getToken() { return null },
      setToken() { },
    }],
  ]);

  private defaultPlugin: RepoPlugin = {
    name: "Unknown repository type",
    optionFieldName: "Branch",
    tokenFieldName: "Token",
    sourceUrlFieldPlaceholder: "URL",
    tokenFieldPlaceholder: "Repository API token",
    usernameFieldHidden: true,
    zoneFieldHidden: true,
    parseSourceUrlField: false,
    getToken() { return null },
    setToken() { },
  };

  constructor() { }

  getRepoTypes(): SelectItem<string>[] {
    return Array.from(this.allPlugins).map(([k, v]) => ({ label: v.name, value: k }));
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
}
