// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface RepoLookupRequest {
  pluginId?: string;
  plugin?: string;
  repoName?: string;
  option?: string;
  url?: string;
  user?: string;
  token?: string;
}
