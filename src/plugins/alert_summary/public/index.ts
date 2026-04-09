import { AlertSummaryPlugin } from './plugin';
export { AlertSummaryCards } from './components/AlertSummaryCards';
export { ALERT_LEVELS, API_ROUTE, INDEX_PATTERN } from '../common';
export const plugin = () => new AlertSummaryPlugin();
