import { Plugin, CoreSetup } from 'opensearch-dashboards/server';
import { registerAlertCountsRoute } from './routes/alert_counts';
import { registerAlertEventsRoute } from './routes/alert_events';

export class AlertSummaryPlugin implements Plugin {
  public setup(core: CoreSetup) {
    const router = core.http.createRouter();
    registerAlertCountsRoute(router);
    registerAlertEventsRoute(router);
  }

  public start() {}
  public stop() {}
}
