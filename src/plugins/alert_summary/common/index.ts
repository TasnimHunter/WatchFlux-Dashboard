export const PLUGIN_ID = 'alert_summary';
export const PLUGIN_NAME = 'Alert Summary';
export const INDEX_PATTERN = 'watchflux-alerts-*';

// Export API_ROUTE as a string constant (singular, not plural)
export const API_ROUTE = '/api/alert_summary/counts';
export const EVENTS_API_ROUTE = '/api/alert_summary/events';

export const ALERT_LEVELS = [
  { id: 'critical', label: 'Critical', min: 15, max: 15, color: '#ff4f4f', bgColor: 'rgba(255,79,79,0.08)', borderColor: 'rgba(255,79,79,0.25)' },
  { id: 'high',     label: 'High',     min: 12, max: 14, color: '#ffb547', bgColor: 'rgba(255,181,71,0.08)', borderColor: 'rgba(255,181,71,0.25)' },
  { id: 'medium',   label: 'Medium',   min: 7,  max: 11, color: '#fde047', bgColor: 'rgba(253,224,71,0.08)', borderColor: 'rgba(253,224,71,0.25)' },
  { id: 'low',      label: 'Low',      min: 1,  max: 6,  color: '#00e5a0', bgColor: 'rgba(0,229,160,0.08)',  borderColor: 'rgba(0,229,160,0.25)'  },
] as const;

// For backward compatibility
export const API_ROUTES = {
  COUNTS: '/api/alert_summary/counts',
  EVENTS: '/api/alert_summary/events'
} as const;
