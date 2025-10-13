export interface Metadata {
  datasetVersion: DatasetVersion;
}
interface DatasetVersion {
  metadataBlocks: Metadatablocks;
}
interface Metadatablocks {
  citation: CitationBlock;
}

interface CitationBlock {
  displayName: string;
  fields: MetadataField[];
  name: string;
}

export interface MetadataField {
  id?: string;
  expandedvalue?: Expandedvalue;
  multiple: boolean;
  typeClass: string;
  typeName: string;
  // Optional provenance of this field (e.g., "codemeta.json", "CITATION.cff").
  // This is for UI display only and is not forwarded on submit.
  source?: string;
  value: string | FieldDictonary[] | string[];
}

export interface FieldDictonary {
  [index: string]: MetadataField;
}

interface Expandedvalue {
  [index: string]: string;
}

export interface Field {
  id?: string;
  parent?: string;
  name?: string;
  action?: Fieldaction;
  leafValue?: string;
  field?: MetadataField | FieldDictonary;
}

export enum Fieldaction {
  Ignore = 0,
  Copy = 1,
  Update = 2,
  Custom = 4,
}
