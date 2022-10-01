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

  constructor(private connectService: ConnectService, private router: Router) { }

  ngOnInit(): void {
  }

  connect() {
    console.log('connecting...');
    let connection_id = this.connectService.login(this.credentials);
    this.router.navigate(['/compare', connection_id]);
  }

}
