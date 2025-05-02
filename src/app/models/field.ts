export interface Metadata {
    datasetVersion: DatasetVersion;
}
export interface DatasetVersion {
    metadataBlocks: Metadatablocks;
}
export interface Metadatablocks {
    citation: CitationBlock;
}

export interface CitationBlock {
    displayName: string;
    fields: MetadataField[];
}

export interface MetadataField {
  expandedvalue?: Expandedvalue;
  multiple: boolean;
  typeClass: string;
  typeName: string;
  value: string | FieldDictonary[] | string[];
}

export interface FieldDictonary {
  [index: string]: MetadataField;
}

export interface Expandedvalue {
    [index: string]: string;
}

export interface Field {
  id: string;
  path?: string;
  name?: string;
  action?: Fieldaction;
  leafValue?: string;
  field?: MetadataField;
}

export enum Fieldaction {
    Ignore = 0,
    Copy = 1,
    Update = 2,
    Custom = 4,
}