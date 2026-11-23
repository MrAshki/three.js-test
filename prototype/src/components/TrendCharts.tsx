import ReactECharts from 'echarts-for-react'
import type { StoryStage } from '../storyData'
import { months } from '../storyData'

type TrendChartsProps = { stage: StoryStage }

const baseAxis = {
  axisLine: { lineStyle: { color: '#293653' } },
  axisTick: { show: false },
  axisLabel: { color: '#8ea0b8', fontSize: 10 },
  splitLine: { lineStyle: { color: '#1e2a43' } },
}

function chartOption(label: string, data: number[], color: string, suffix: string) {
  return {
    animationDuration: 420,
    animationDurationUpdate: 320,
    backgroundColor: 'transparent',
    grid: { left: 42, right: 14, top: 24, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#182343',
      borderColor: '#293653',
      textStyle: { color: '#f8fafc' },
      formatter: (items: Array<{ axisValue: string; value: number }>) => `${items[0].axisValue}<br/>${label}: ${items[0].value}${suffix}`,
    },
    xAxis: { type: 'category', data: months, boundaryGap: false, ...baseAxis },
    yAxis: { type: 'value', min: Math.min(...data) - 8, max: Math.max(...data) + 8, ...baseAxis },
    series: [{
      name: label,
      type: 'line',
      data,
      smooth: 0.32,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5, color },
      itemStyle: { color, borderColor: '#0b1020', borderWidth: 2 },
      areaStyle: { color, opacity: 0.08 },
    }],
  }
}

export function TrendCharts({ stage }: TrendChartsProps) {
  return <div className="chart-grid" data-testid="chart-grid" data-stage={stage.id}>
    <article className="chart-card">
      <header><span>SALES INDEX</span><strong>{stage.sales.at(-1)}</strong></header>
      <ReactECharts option={chartOption('Sales', stage.sales, '#fb7185', '')} notMerge lazyUpdate style={{ height: 176 }} />
    </article>
    <article className="chart-card">
      <header><span>INVENTORY UNITS</span><strong>{stage.inventory.at(-1)}</strong></header>
      <ReactECharts option={chartOption('Inventory', stage.inventory, '#60a5fa', '')} notMerge lazyUpdate style={{ height: 176 }} />
    </article>
  </div>
}
