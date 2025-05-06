import { CompareResult } from "./compare-result";

export interface MetadataRequest {
	pluginId?: string;
	plugin?: string;
	repoName?: string;
	url?: string;
	option?: string;
	user?: string;
	token?: string;
	dvToken?: string;
	compareResult: CompareResult | null;
}