// Author: Kris Dekeyser @ KU Leuven (2023). Apache 2.0 License
// Changed by: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'datasync';

  constructor(private primengConfig: PrimeNGConfig) {}
  ngOnInit(): void {
    this.primengConfig.ripple = true;
  }

}
