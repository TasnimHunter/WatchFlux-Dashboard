import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { EuiPanel, EuiTitle, EuiFlexGroup, EuiFlexItem, EuiText } from '@elastic/eui';

interface TimelinePoint {
  timestamp: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface Props {
  data: TimelinePoint[];
  hours: number;
}

export const TimelineChart: React.FC<Props> = ({ data, hours }) => {
  // Get current time
  const now = new Date();
  const currentHour = now.getHours();
  const currentDate = now.toLocaleDateString();
  
  // Format the data with proper time display
  const formattedData = data.map(point => {
    const date = new Date(point.timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Create a readable time label
    const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
    const fullDateTime = `${month}/${day} ${hour.toString().padStart(2, '0')}:00`;
    
    return {
      time: timeLabel,
      fullDateTime: fullDateTime,
      hour: hour,
      timestamp: point.timestamp,
      total: point.total,
    };
  });

  // Sort data by timestamp
  const sortedData = [...formattedData].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const totalAlerts = data.reduce((sum, point) => sum + point.total, 0);
  
  // Get the actual time range
  const startTime = sortedData[0] ? new Date(sortedData[0].timestamp) : null;
  const endTime = sortedData[sortedData.length-1] ? new Date(sortedData[sortedData.length-1].timestamp) : null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = sortedData.find(d => d.time === label);
      const date = dataPoint ? new Date(dataPoint.timestamp) : null;
      const dateStr = date ? date.toLocaleString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }) : label;
      
      return (
        <div style={{
          background: '#1e1e2e',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px'
        }}>
          <p style={{ margin: '0 0 4px 0', color: '#fff', fontWeight: 'bold' }}>
            {dateStr}
          </p>
          <p style={{ margin: '0', color: '#4f8fff' }}>
            {payload[0].value.toLocaleString()} alerts
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <EuiPanel paddingSize="m" style={{ height: '100%', background: '#0a0c12' }}>
      <EuiFlexGroup direction="column" gutterSize="xs" style={{ height: '100%' }}>
        <EuiFlexItem grow={false}>
          <EuiFlexGroup justifyContent="spaceBetween" alignItems="center">
            <EuiFlexItem grow={false}>
              <EuiTitle size="xxs">
                <h4 style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 500 }}>
                  Alert Timeline
                </h4>
              </EuiTitle>
              <EuiText size="xs" style={{ color: '#8b8b8b', fontSize: '11px' }}>
                {totalAlerts.toLocaleString()} total alerts
                {startTime && endTime && ` · ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiText size="xs" style={{ color: '#4f8fff', fontSize: '10px', fontWeight: 'bold' }}>
                Now: {currentHour.toString().padStart(2, '0')}:00
              </EuiText>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>

        <EuiFlexItem grow={1} style={{ minHeight: 0 }}>
          <div style={{ width: '100%', height: '100%', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sortedData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis 
                  dataKey="time" 
                  stroke="#8b8b8b" 
                  tick={{ fill: '#8b8b8b', fontSize: 10 }}
                  interval={Math.floor(sortedData.length / 6)}
                />
                <YAxis stroke="#8b8b8b" tick={{ fill: '#8b8b8b', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#4f8fff" 
                  fill="#4f8fff" 
                  fillOpacity={0.6}
                  name="Total Alerts"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </EuiFlexItem>
      </EuiFlexGroup>
    </EuiPanel>
  );
};
