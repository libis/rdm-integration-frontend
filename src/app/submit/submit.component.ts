import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { Datafile, Fileaction } from '../models/datafile';
import { Router } from '@angular/router';
import { StoreResult } from '../models/store-result';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitComponent implements OnInit {

  constructor(
    private dataService: DataService,
    private router: Router,
  ) { }

  ngOnInit(): void {
  }

  created() : Datafile[] {
    let result: Datafile[] = [];
    this.dataService.compare_result.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    })
    return result;
  }

  updated() : Datafile[] {
    let result: Datafile[] = [];
    this.dataService.compare_result.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    })
    return result;
  }

  deleted() : Datafile[] {
    let result: Datafile[] = [];
    this.dataService.compare_result.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Delete) {
        result.push(datafile);
      }
    })
    return result;
  }

  submit() {
    let selected: Datafile[] = [];
    this.dataService.compare_result.data?.forEach(datafile => {
      let action = datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) {
        selected.push(datafile)
      }
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }
    this.dataService.submit(selected).subscribe((data: StoreResult) => {
      if (data.status !== "OK") {
        console.error("store failed: " + data.status);
      }
      this.router.navigate(['/connect']);
    });
  }

}
