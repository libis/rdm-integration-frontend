import { Injectable } from '@angular/core';
import { CompareResult, ResultStatus } from './models/compare-result';
import { Fileaction, Filestatus } from './models/datafile';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  compare_result: CompareResult = {
    id: '12345678',
    status: ResultStatus.Finished,
    data: [
      { path: '', name: '.gitignore', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'as-setup.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'post-install-api-block.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-all.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-builtin-roles.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-datasetfields.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-dvs.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-identity-providers.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'setup-users.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'dvinstall', name: 'update-fields.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: '', name: 'env.dev', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: '', name: 'env.prod', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'bootstrap-job.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'builtin-users-disable.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'builtin-users-key.sh', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'config', status: Filestatus.Equal, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'default.config', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'deploy.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin/init.d', name: 'appendJvmOptions.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin/init.d', name: 'removeExpiredCerts.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'init_0_deploy_dataverse.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'security-local.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse/bin', name: 'security-token.sh', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'images/dataverse', name: 'Dockerfile', status: Filestatus.New, action: Fileaction.Ignore },
      { path: '', name: 'Makefile', status: Filestatus.New, action: Fileaction.Ignore },
      { path: 'py', name: 'readOptions.py', status: Filestatus.Deleted, action: Fileaction.Ignore },
      { path: 'py', name: 'reports.py', status: Filestatus.Deleted, action: Fileaction.Ignore },
      { path: '', name: 'README.md', status: Filestatus.Updated, action: Fileaction.Ignore },
    ]
  };

  constructor() { }

  getData(id: string): CompareResult {
    return this.compare_result;
  }
}
