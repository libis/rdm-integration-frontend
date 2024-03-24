// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { DataService } from './data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'datasync';

  constructor(private primengConfig: PrimeNGConfig, public dataService: DataService) { }
  ngOnInit(): void {
    this.primengConfig.ripple = true;
    const dvToken = localStorage.getItem("dataverseToken");
    const subscription = this.dataService.checkAccessToQueue('', dvToken ? dvToken : '', '').subscribe({
      next: (access) => {
        subscription.unsubscribe();
        if (!access.access) {
          const computeLink = document.getElementById('navbar-compute-li') as HTMLElement;
          computeLink?.style.setProperty('display', 'none')
        }
      },
      error: (err) => {
        const computeLink = document.getElementById('navbar-compute-li') as HTMLElement;
        computeLink?.style.setProperty('display', 'none')
      }
    });
  }

}
