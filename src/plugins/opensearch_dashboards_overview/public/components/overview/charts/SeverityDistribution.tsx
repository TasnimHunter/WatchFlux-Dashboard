import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { EuiPanel, EuiTitle, EuiFlexGroup, EuiFlexItem, EuiText } from '@elastic/eui';

interface Props {
  data: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const SeverityDistribution: React.FC<Props> = ({ data }) => {
  const chartData = [
    { name: 'Critical', value: data.critical, color: '#ff6b6b' },
    { name: 'High', value: data.high, color: '#ffa500' },
    { name: 'Medium', value: data.medium, color: '#ffd966' },
    { name: 'Low', value: data.low, color: '#00e5a0' },
  ].filter(d => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <EuiPanel paddingSize="m" style={{ height: '100%', background: '#0a0c12' }}>
      <EuiFlexGroup direction="column" gutterSize="xs" style={{ height: '100%' }}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxs">
            <h4 style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>Severity Distribution</h4>
          </EuiTitle>
          <EuiText size="xs" style={{ color: '#8b8b8b', fontSize: '11px' }}>
            {total.toLocaleString()} total alerts
          </EuiText>
        </EuiFlexItem>

        <EuiFlexItem grow={1} style={{ minHeight: 0 }}>
          <div style={{ width: '100%', height: '100%', minHeight: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  innerRadius={35}
                  dataKey="value"
                  label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                  labelLine={false}
                  fontSize={10}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} alerts`, 'Count']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};
