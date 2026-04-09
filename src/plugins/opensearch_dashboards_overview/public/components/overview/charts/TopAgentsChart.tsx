import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { EuiPanel, EuiTitle, EuiFlexGroup, EuiFlexItem, EuiText } from '@elastic/eui';

interface AgentData {
  name: string;
  count: number;
}

interface Props {
  data: AgentData[];
}

export const TopAgentsChart: React.FC<Props> = ({ data }) => {
  const topAgents = data.slice(0, 6);
  const totalAlerts = topAgents.reduce((sum, agent) => sum + agent.count, 0);

  return (
    <EuiPanel paddingSize="m" style={{ height: '100%', background: '#0a0c12' }}>
      <EuiFlexGroup direction="column" gutterSize="xs" style={{ height: '100%' }}>
        <EuiFlexItem grow={false}>
          <EuiTitle size="xxs">
            <h4 style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>Top Alert Sources</h4>
          </EuiTitle>
          <EuiText size="xs" style={{ color: '#8b8b8b', fontSize: '11px' }}>
            Top {topAgents.length} · {totalAlerts.toLocaleString()} alerts
          </EuiText>
        </EuiFlexItem>

        <EuiFlexItem grow={1} style={{ minHeight: 0 }}>
          <div style={{ width: '100%', height: '100%', minHeight: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topAgents}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 50, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis type="number" stroke="#8b8b8b" tick={{ fill: '#8b8b8b', fontSize: 10 }} />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  stroke="#8b8b8b" 
                  tick={{ fill: '#8b8b8b', fontSize: 10 }}
                  width={45}
                />
                <Tooltip 
                  contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value.toLocaleString()} alerts`, 'Count']}
                />
                <Bar dataKey="count" fill="#4f8fff" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};
