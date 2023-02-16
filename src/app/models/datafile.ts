// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

export enum Filestatus {
  Equal = 0,
  New = 1,
  Updated = 2,
  Deleted = 3,
  Unknown = 4
}

export enum Fileaction {
  Ignore = 0,
  Copy = 1,
  Update = 2,
  Delete = 3,
  Custom = 4,
}

export interface Datafile {
  path?: string;
  name?: string;
  status?: Filestatus;
  action?: Fileaction;
  hidden?: boolean;
  id?: string;
  attributes?: Attributes
}

export interface Attributes {
	url?: string;
	remoteHash?: string;
	remoteHashType?: string;
	remoteFilesize?: number;
	isFile?: boolean;
	destinatinFile?: DestinatinFile;
}

export interface DestinatinFile {
	id?: number;
	filesize?: number;
	hash?: string;
	hashType?: string;
	storageIdentifier?: string;
}
