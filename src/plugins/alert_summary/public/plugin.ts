/*
 * Alert Summary Plugin
 */
import {
  CoreSetup,
  CoreStart,
  Plugin,
} from 'opensearch-dashboards/public';

interface AlertSummarySetupDeps {
  contentManagement: any;
  home: any;
}

interface AlertSummaryStartDeps {
  contentManagement: any;
}

export class AlertSummaryPlugin
  implements Plugin<void, void, AlertSummarySetupDeps, AlertSummaryStartDeps> {
  public setup(core: CoreSetup, deps: AlertSummarySetupDeps) {}
  public start(core: CoreStart, deps: AlertSummaryStartDeps) {}
  public stop() {}
}