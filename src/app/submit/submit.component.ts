import { Component, OnInit } from '@angular/core';
import { DataService } from '../data.service';
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitComponent implements OnInit {

  data: CompareResult = {};

  constructor(
    private dataService: DataService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.data = this.dataService.compare_result;
  }

  created() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    })
    return result;
  }

  updated() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    })
    return result;
  }

  deleted() : Datafile[] {
    let result: Datafile[] = [];
    this.data.data?.forEach(datafile => {
      if (datafile.action === Fileaction.Delete) {
        result.push(datafile);
      }
    })
    return result;
  }

}
