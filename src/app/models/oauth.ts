// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface LoginState {
  sourceUrl?: string;
  url?: string;
  plugin?: Item;
  pluginId?: Item;
  repoName?: string;
  user?: string;
  nonce?: string;
  code?: string;
  option?: Item;
  datasetId?: Item;
  collectionId?: Item;
  download?: boolean;
  downloadId?: string;
  accessMode?: 'guest' | 'preview' | 'login';
  previewUrlToken?: string;
}

export interface Item {
  label?: string;
  value?: string;
  hidden?: boolean;
}

export interface TokenResponse {
  session_id: string;
}
