/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { CoreStart } from 'opensearch-dashboards/public';
import { DEFAULT_NAV_GROUPS } from '../../../../core/public';
import {
  ContentManagementPluginSetup,
  ContentManagementPluginStart,
  HOME_PAGE_ID,
  SECTIONS,
  HOME_CONTENT_AREAS,
  SEARCH_OVERVIEW_PAGE_ID,
  OBSERVABILITY_OVERVIEW_PAGE_ID,
  SECURITY_ANALYTICS_OVERVIEW_PAGE_ID,
} from '../../../../plugins/content_management/public';
import { getLearnOpenSearchConfig, registerHomeListCard } from './components/home_list_card';
import { registerUseCaseCard } from './components/use_case_card';
import { AlertSummaryCards } from './components/alert_summary_cards';

const ALERT_CARDS_AREA = `${HOME_PAGE_ID}/alert_summary_section`;

export const setupHome = (contentManagement: ContentManagementPluginSetup) => {
  contentManagement.registerPage({
    id: HOME_PAGE_ID,
    title: 'Home',
    sections: [
      {
        id: 'alert_summary_section',
        order: 1000,
        kind: 'custom',
        render: (contents) => {
          return (
            <>
              {contents.map((content) => {
                if (content.kind === 'custom') {
                  return <React.Fragment key={content.id}>{content.render()}</React.Fragment>;
                }
                return null;
              })}
            </>
          );
        },
      },
      {
        id: SECTIONS.SERVICE_CARDS,
        order: 2000,
        kind: 'dashboard',
      },
    ],
  });
};

export const initHome = (contentManagement: ContentManagementPluginStart, core: CoreStart) => {
  const workspaceEnabled = core.application.capabilities.workspaces.enabled;

  if (!workspaceEnabled) {
    const useCases = [
      { ...DEFAULT_NAV_GROUPS.observability, navigateAppId: OBSERVABILITY_OVERVIEW_PAGE_ID },
      { ...DEFAULT_NAV_GROUPS.search, navigateAppId: SEARCH_OVERVIEW_PAGE_ID },
      {
        ...DEFAULT_NAV_GROUPS['security-analytics'],
        navigateAppId: SECURITY_ANALYTICS_OVERVIEW_PAGE_ID,
      },
    ];

    useCases.forEach((useCase, index) => {
      registerUseCaseCard(contentManagement, core, {
        id: useCase.id,
        order: index + 1,
        description: useCase.description,
        title: useCase.title,
        target: HOME_CONTENT_AREAS.GET_STARTED,
        icon: useCase.icon ?? '',
        navigateAppId: useCase.navigateAppId,
      });
    });
  }

  registerHomeListCard(contentManagement, {
    id: 'learn_opensearch_new',
    order: 11,
    config: getLearnOpenSearchConfig(core.docLinks),
    target: HOME_CONTENT_AREAS.SERVICE_CARDS,
    width: workspaceEnabled ? 32 : 48,
  });

  // Clickable alert summary cards
  contentManagement.registerContentProvider({
    id: 'alert_summary_cards_provider',
    getTargetArea: () => ALERT_CARDS_AREA,
    getContent: () => ({
      id: 'alert_summary_cards',
      kind: 'custom',
      order: 0,
      width: 48,
      render: () => <AlertSummaryCards core={core} />,
    }),
  });

  // Summary Dashboard embedded on home page
  contentManagement.registerContentProvider({
    id: 'summary_dashboard_provider',
    getTargetArea: () => HOME_CONTENT_AREAS.SERVICE_CARDS,
    getContent: () => ({
      id: 'summary_dashboard',
      kind: 'dashboard',
      order: 1,
      input: {
        kind: 'static',
        id: '543a8810-2f2a-11f1-af47-1992e8615f02',
      },
    }),
  });
};