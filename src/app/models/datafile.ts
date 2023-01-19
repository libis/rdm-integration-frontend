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
	parentId?: string;
	localHash?: string;
	remoteHash?: string;
	remoteHashType?: string;
	isFile?: boolean;
	metadata?: Metadata;
}

export interface Metadata {
	description?: string;
	label?: string;
	restricted?: boolean;
	directoryLabel?: string;
	version?: number;
	datasetVersionId?: number;
	categories?: string[];
	dataFile?: DVDataFile;
}

export interface DVDataFile {
	id?: number;
	persistentId?: string;
	pidURL?: string;
	filename?: string;
	contentType ?: string;
	filesize?: number;
	description?: string;
	storageIdentifier?: string;
	rootDataFileId?: number;
	md5?: string;
	checksum?: Checksum;
	creationDate?: string;
}

export interface Checksum {
	type?: string;
	value?: string;
}