import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ConnectService } from '../connect.service';
import { Credentials } from '../models/credentials';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  credentials: Credentials = {};

  repoType: string = '';
  repoOwner: string = '';
  repoName: string = '';
  repoBranch: string = '';
  repoToken: string = '';
  datasetId: string = '';
  dataverseToken: string = '';

  constructor(private connectService: ConnectService, private router: Router) { }

  ngOnInit(): void {
  }

  connect() {
    console.log('connecting...');
    this.credentials = {
      repo_type: this.repoType,
      repo_owner: this.repoOwner,
      repo_name: this.repoName,
      repo_branch: this.repoBranch,
      repo_token: this.repoToken,
      dataset_id: this.datasetId,
      dataverse_token: this.dataverseToken,
    }
    let connection_id = this.connectService.login(this.credentials);
    this.router.navigate(['/compare', connection_id]);
  }

}
