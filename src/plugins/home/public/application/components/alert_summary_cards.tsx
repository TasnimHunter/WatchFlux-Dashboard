/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiPanel,
  EuiStat,
  EuiLoadingSpinner,
  EuiText,
  EuiButtonIcon,
  EuiToolTip,
} from '@elastic/eui';
import { CoreStart } from 'opensearch-dashboards/public';

interface Props {
  core: CoreStart;
}

interface AlertCounts {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const INDEX_NAME = 'watchflux-alerts-*';
const INDEX_PATTERN_ID = '453365c0-2107-11f1-ae64-39ebdb834ed6';

const SEVERITY_RANGES = {
  low:      { gte: 1,  lte: 6  },
  medium:   { gte: 7,  lte: 9  },
  high:     { gte: 10, lte: 12 },
  critical: { gte: 13, lte: 15 },
};

const buildDiscoverUrl = (severity: string | null): string => {
  const base =
    `/app/data-explorer/discover#?` +
    `_a=(discover:(columns:!(_source),isDirty:!f,sort:!()),` +
    `metadata:(indexPattern:'${INDEX_PATTERN_ID}',view:discover))`;

  const query = severity
    ? `rule.level >= ${SEVERITY_RANGES[severity as keyof typeof SEVERITY_RANGES].gte} and rule.level <= ${SEVERITY_RANGES[severity as keyof typeof SEVERITY_RANGES].lte}`
    : '';

  const filterParam = `_q=(filters:!(),query:(language:kuery,query:'${encodeURIComponent(query)}'))`;
  const globalParam = `_g=(filters:!(),refreshInterval:(pause:!t,value:0),time:(from:now-1w,to:now))`;

  return `${base}&${filterParam}&${globalParam}`;
};

const CARDS = [
  {
    label: 'Total Alerts',
    key: 'total' as keyof AlertCounts,
    severity: null,
    color: '#a3a3ff',
    bg: 'rgba(100,100,255,0.08)',
    border: 'rgba(163,163,255,0.4)',
  },
  {
    label: 'Critical',
    key: 'critical' as keyof AlertCounts,
    severity: 'critical',
    color: '#ff4444',
    bg: 'rgba(255,68,68,0.08)',
    border: 'rgba(255,68,68,0.4)',
  },
  {
    label: 'High',
    key: 'high' as keyof AlertCounts,
    severity: 'high',
    color: '#ff8c00',
    bg: 'rgba(255,140,0,0.08)',
    border: 'rgba(255,140,0,0.4)',
  },
  {
    label: 'Medium',
    key: 'medium' as keyof AlertCounts,
    severity: 'medium',
    color: '#f0e68c',
    bg: 'rgba(240,230,140,0.08)',
    border: 'rgba(240,230,140,0.4)',
  },
  {
    label: 'Low',
    key: 'low' as keyof AlertCounts,
    severity: 'low',
    color: '#90ee90',
    bg: 'rgba(144,238,144,0.08)',
    border: 'rgba(144,238,144,0.4)',
  },
];

export const AlertSummaryCards = ({ core }: Props) => {
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = (await core.http.post('/api/console/proxy', {
        query: {
          path: `${INDEX_NAME}/_search`,
          method: 'POST',
        },
        body: JSON.stringify({
          size: 0,
          track_total_hits: true,
          query: {
            range: {
              timestamp: {
                gte: 'now-1w',
                lte: 'now',
              },
            },
          },
          aggs: {
            critical: { filter: { range: { 'rule.level': SEVERITY_RANGES.critical } } },
            high:     { filter: { range: { 'rule.level': SEVERITY_RANGES.high } } },
            medium:   { filter: { range: { 'rule.level': SEVERITY_RANGES.medium } } },
            low:      { filter: { range: { 'rule.level': SEVERITY_RANGES.low } } },
          },
        }),
      })) as any;

      setCounts({
        total:    response.hits.total.value,
        critical: response.aggregations.critical.doc_count,
        high:     response.aggregations.high.doc_count,
        medium:   response.aggregations.medium.doc_count,
        low:      response.aggregations.low.doc_count,
      });
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [core.http]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  if (loading) {
    return (
      <EuiFlexGroup justifyContent="center" alignItems="center" style={{ padding: '20px' }}>
        <EuiFlexItem grow={false}>
          <EuiLoadingSpinner size="l" />
        </EuiFlexItem>
      </EuiFlexGroup>
    );
  }

  if (error || !counts) {
    return (
      <EuiText color="danger" textAlign="center">
        Failed to load alert counts.
      </EuiText>
    );
  }

  return (
    <>
      <EuiFlexGroup justifyContent="flexEnd" style={{ padding: '4px 0 0 0' }}>
        <EuiFlexItem grow={false}>
          <EuiToolTip content="Refresh alert counts">
            <EuiButtonIcon
              iconType="refresh"
              onClick={fetchCounts}
              aria-label="Refresh alerts"
              color="primary"
              display="base"
              size="s"
            />
          </EuiToolTip>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiFlexGroup gutterSize="m" style={{ padding: '12px 0' }}>
        {CARDS.map((card) => (
          <EuiFlexItem key={card.key}>
            <EuiPanel
              hasShadow={false}
              hasBorder={false}
              style={{
                cursor: 'pointer',
                backgroundColor: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: '8px',
                textAlign: 'center',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                padding: '20px',
              }}
              onClick={() => core.application.navigateToUrl(buildDiscoverUrl(card.severity))}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'translateY(-3px)';
                el.style.boxShadow = `0 6px 16px ${card.color}55`;
                el.style.borderColor = card.color;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'translateY(0)';
                el.style.boxShadow = 'none';
                el.style.borderColor = card.border;
              }}
            >
              <EuiStat
                title={counts[card.key].toLocaleString()}
                description={card.label}
                titleColor="custom"
                textAlign="center"
                style={{ '--euiStatTitleColor': card.color } as React.CSSProperties}
              />
            </EuiPanel>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>
    </>
  );
};