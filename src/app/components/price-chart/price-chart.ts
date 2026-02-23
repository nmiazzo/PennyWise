import { Component, input, computed } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { SupermarketPriceData } from '../../models/product.model';

const LINE_COLORS = [
  '#1976d2',
  '#d32f2f',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0097a7',
  '#c2185b',
  '#455a64',
];

function toDayTimestamp(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

@Component({
  selector: 'pw-price-chart',
  imports: [BaseChartDirective],
  templateUrl: './price-chart.html',
  styleUrl: './price-chart.scss',
})
export class PriceChart {
  readonly supermarkets = input.required<SupermarketPriceData[]>();

  readonly chartData = computed<ChartData<'line'>>(() => {
    const sms = this.supermarkets();

    // Group each supermarket's prices by day, keeping the last record per day
    const smDayMaps: Map<number, number>[] = [];
    const allDays = new Set<number>();

    for (const sm of sms) {
      const dayMap = new Map<number, number>();
      for (const record of sm.fullPriceHistory) {
        const day = toDayTimestamp(record.timestamp);
        // Later records overwrite earlier ones on the same day
        dayMap.set(day, record.price);
        allDays.add(day);
      }
      smDayMaps.push(dayMap);
    }

    const sortedDays = Array.from(allDays).sort((a, b) => a - b);
    const labels = sortedDays.map((ts) =>
      new Date(ts).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
      }),
    );

    const datasets = sms.map((sm, index) => {
      const dayMap = smDayMaps[index];
      const data = sortedDays.map((day) => {
        const cents = dayMap.get(day);
        return cents !== undefined ? cents / 100 : null;
      });

      return {
        label: sm.brand,
        data,
        borderColor: LINE_COLORS[index % LINE_COLORS.length],
        backgroundColor: LINE_COLORS[index % LINE_COLORS.length] + '33',
        tension: 0.3,
        spanGaps: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });

    return { labels, datasets };
  });

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return value !== null
              ? `${context.dataset.label}: \u20AC${value.toFixed(2)}`
              : '';
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (value) => `\u20AC${Number(value).toFixed(2)}`,
        },
      },
    },
  };
}
