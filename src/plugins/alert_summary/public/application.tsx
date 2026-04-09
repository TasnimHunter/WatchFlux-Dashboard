import React from 'react';
import ReactDOM from 'react-dom';
import { AppMountParameters, CoreStart } from 'opensearch-dashboards/public';
import { AlertSummaryCards } from './components/AlertSummaryCards';

export const renderApp = (core: CoreStart, { element }: AppMountParameters) => {
  ReactDOM.render(
    <div style={{ padding: '24px' }}>
      <AlertSummaryCards core={core} />
    </div>,
    element
  );
  return () => ReactDOM.unmountComponentAtNode(element);
};
