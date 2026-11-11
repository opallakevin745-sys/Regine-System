import { useEffect, useRef, useState } from 'react';
import { compactMoney, count, money } from '../lib/format';

const HEIGHT = 220;
const MARGIN = { top: 26, right: 8, bottom: 34, left: 52 };
const BAR_MAX = 24;
const RADIUS = 4;

function niceScale(max) {
  if (max <= 0) return { top: 1000, step: 250 };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough);
  return { top: Math.ceil(max / step) * step, step };
}

// Column with a 4px rounded data end and a square baseline.
function barPath(x, y, width, height) {
  const r = Math.min(RADIUS, height, width / 2);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short' });
const longLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

/** Single-series daily sales columns. `days`: [{ date: 'YYYY-MM-DD', total, transactions }], oldest first. */
export default function SalesChart({ days }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...days.map((day) => day.total));
  const { top, step } = niceScale(max);
  const plotWidth = width - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / days.length;
  const barWidth = Math.min(BAR_MAX, band * 0.55);
  const yFor = (value) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const ticks = [];
  for (let value = 0; value <= top + step / 2; value += step) ticks.push(value);
  const peakIndex = max > 0 ? days.findIndex((day) => day.total === max) : -1;
  const lastIndex = days.length - 1;
  const activeDay = active === null ? null : days[active];

  return (
    <div className="sales-chart">
      <div className="chart-canvas" ref={wrapRef} onPointerLeave={() => setActive(null)}>
        <svg width={width} height={HEIGHT} role="img" aria-label={`Completed sales for the last ${days.length} days`}>
          {ticks.map((value) => (
            <g key={value}>
              <line className="chart-grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={yFor(value)} y2={yFor(value)} />
              <text className="chart-axis" x={MARGIN.left - 8} y={yFor(value)} dy="0.32em" textAnchor="end">{value === 0 ? '0' : compactMoney(value)}</text>
            </g>
          ))}
          {days.map((day, index) => {
            const x = MARGIN.left + band * index + (band - barWidth) / 2;
            const y = yFor(day.total);
            const height = MARGIN.top + plotHeight - y;
            return (
              <g key={day.date}>
                {day.total > 0 && <path className={`chart-bar${active === index ? ' is-active' : ''}`} d={barPath(x, y, barWidth, height)} />}
                {index === peakIndex && (
                  <text className="chart-value" x={x + barWidth / 2} y={y - 8} textAnchor="middle">{compactMoney(day.total)}</text>
                )}
                <text className={`chart-axis${index === lastIndex ? ' is-today' : ''}`} x={MARGIN.left + band * index + band / 2} y={HEIGHT - 12} textAnchor="middle">
                  {index === lastIndex ? 'Today' : dayLabel(day.date)}
                </text>
                <rect
                  className="chart-hit"
                  x={MARGIN.left + band * index}
                  y={MARGIN.top}
                  width={band}
                  height={plotHeight}
                  tabIndex={0}
                  aria-label={`${longLabel(day.date)}: ${money(day.total)} from ${count(day.transactions)} sales`}
                  onPointerEnter={() => setActive(index)}
                  onPointerMove={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            );
          })}
        </svg>
        {activeDay && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(width - 90, Math.max(90, MARGIN.left + band * active + band / 2)),
              top: Math.max(4, yFor(activeDay.total) - 64)
            }}
            role="status"
          >
            <strong>{money(activeDay.total)}</strong>
            <span>{longLabel(activeDay.date)} · {count(activeDay.transactions)} sales</span>
          </div>
        )}
      </div>
      <button type="button" className="link-button chart-table-toggle" onClick={() => setShowTable((current) => !current)} aria-expanded={showTable}>
        {showTable ? 'Hide table' : 'View as table'}
      </button>
      {showTable && (
        <table className="mini-table">
          <thead><tr><th scope="col">Day</th><th scope="col" className="align-right">Sales</th><th scope="col" className="align-right">Transactions</th></tr></thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date}><td>{longLabel(day.date)}</td><td className="align-right">{money(day.total)}</td><td className="align-right">{count(day.transactions)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
