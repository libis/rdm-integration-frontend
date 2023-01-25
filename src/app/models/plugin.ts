// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export interface RepoPlugin {
    id: string;
    name: string;
    optionFieldName?: string;
    optionFieldPlaceholder?: string;
    tokenFieldName?: string;
    tokenFieldPlaceholder?: string;
    sourceUrlFieldName: string;
    sourceUrlFieldPlaceholder: string;
    usernameFieldName?: string;
    usernameFieldPlaceholder?: string;
    zoneFieldName?: string;
    zoneFieldPlaceholder?: string;
    parseSourceUrlField: boolean;
    tokenName?: string;
}

export interface Config {
    dataverseHeader: string;
    collectionOptionsHidden: boolean;
    createNewDatasetEnabled: boolean;
    datasetFieldEditable: boolean;
    collectionFieldEditable: boolean;
    plugins: RepoPlugin[];
}