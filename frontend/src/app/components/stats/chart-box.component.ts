import { Component, Input } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';

/**
 * Enveloppe d'un graphique ApexCharts : on lui passe un seul objet d'options,
 * ce qui évite de répéter une quinzaine de liaisons dans chaque écran.
 */
@Component({
  selector: 'app-chart-box',
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
    @if (options) {
      <apx-chart
        [series]="options.series"
        [chart]="options.chart"
        [xaxis]="options.xaxis"
        [yaxis]="options.yaxis"
        [stroke]="options.stroke"
        [dataLabels]="options.dataLabels"
        [legend]="options.legend"
        [fill]="options.fill"
        [tooltip]="options.tooltip"
        [grid]="options.grid"
        [colors]="options.colors"
        [labels]="options.labels"
        [plotOptions]="options.plotOptions"
        [markers]="options.markers"
        [states]="options.states"
      ></apx-chart>
    }
  `
})
export class ChartBoxComponent {
  @Input() options: any = null;
}
