// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface Credentials {
  pluginId?: string;
  plugin?: string;
  repo_name?: string;
  url?: string;
  option?: string;
  user?: string;
  token?: string;
  dataset_id?: string;
  newly_created?: boolean;
  dataverse_token?: string;
  // Indicates that metadata will be created even if no files selected for a new dataset
  metadata_available?: boolean;
}
