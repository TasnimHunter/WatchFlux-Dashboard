/*
 * Alert Summary — Cards + Recent Events Table
 */
import React, { useEffect, useState, useCallback, Fragment } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiLoadingSpinner,
  EuiText,
  EuiTitle,
  EuiToolTip,
  EuiButtonEmpty,
  EuiBadge,
  EuiSpacer,
  EuiHorizontalRule,
  EuiButtonIcon,
  EuiCodeBlock,
  EuiDescriptionList,
} from '@elastic/eui';
import rison from 'rison-node';
import { CoreStart } from 'opensearch-dashboards/public';
import { ALERT_LEVELS, API_ROUTE } from '../../common';

const EVENTS_ROUTE = '/api/alert_summary/events';

interface Props {
  core: CoreStart;
  indexPattern?: string;
}

interface AlertCounts {
  [key: string]: number;
}

interface AlertEvent {
  id: string;
  timestamp: string;
  agentName: string;
  ruleDescription: string;
  ruleLevel: number;
  ruleId: string;
  ruleGroups: string[];
  location: string;
  fullLog: string;
  managerName: string;
  raw: Record<string, any>;
}

// ── Severity badge ───────────────────────────────────
const SeverityBadge = ({ level }: { level: number }) => {
  const lvl = ALERT_LEVELS.find((l) => level >= l.min && level <= l.max);
  if (!lvl) return <EuiBadge>{level}</EuiBadge>;
  return (
    <EuiBadge style={{ background: lvl.bgColor, color: lvl.color, border: `1px solid ${lvl.borderColor}`, fontWeight: 700 }}>
      {lvl.label} {level}
    </EuiBadge>
  );
};

// ── Format timestamp ─────────────────────────────────
const formatTs = (ts: string) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return ts;
  }
};

// ── Details panel (expanded row) ─────────────────────
const EventDetails = ({ event }: { event: AlertEvent }) => {
  const details = [
    { title: 'Timestamp', description: event.timestamp || '—' },
    { title: 'Agent', description: event.agentName || '—' },
    { title: 'Rule ID', description: event.ruleId || '—' },
    { title: 'Rule Level', description: String(event.ruleLevel ?? '—') },
    { title: 'Groups', description: (event.ruleGroups || []).join(', ') || '—' },
    { title: 'Manager', description: event.managerName || '—' },
    { title: 'Location', description: event.location || '—' },
  ];

  return (
    <div className="alertEvents__details">
      <EuiFlexGroup gutterSize="xl" responsive={false}>
        <EuiFlexItem grow={false} style={{ minWidth: 320 }}>
          <EuiDescriptionList
            type="column"
            columnWidths={[1, 2]}
            listItems={details}
            className="alertEvents__detailsList"
          />
        </EuiFlexItem>
        {event.fullLog && (
          <EuiFlexItem>
            <EuiText size="xs" className="alertEvents__detailsLabel">Full log</EuiText>
            <EuiCodeBlock language="text" fontSize="s" paddingSize="s" isCopyable>
              {event.fullLog}
            </EuiCodeBlock>
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </div>
  );
};

// ── Main component ───────────────────────────────────
export const AlertSummaryCards: React.FC<Props> = ({ core, indexPattern }) => {
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchCounts = useCallback(async () => {
    setLoadingCounts(true);
    try {
      const res = await core.http.get(API_ROUTE, { query: { index: indexPattern } });
      setCounts((res as any).counts);
      setLastUpdated(new Date());
    } catch {
      setCounts({ critical: 0, high: 0, medium: 0, low: 0 });
    } finally {
      setLoadingCounts(false);
    }
  }, [core.http, indexPattern]);

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const res = await core.http.get(EVENTS_ROUTE, {
        query: { index: indexPattern, size: 15, hours: 1 },
      });
      setEvents((res as any).events || []);
    } catch {
      setEvents([]);
    } finally {
      setLoadingEvents(false);
    }
  }, [core.http, indexPattern]);

  const fetchAll = useCallback(() => {
    fetchCounts();
    fetchEvents();
  }, [fetchCounts, fetchEvents]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const navigateToDiscover = useCallback(
    (levelId: string) => {
      const level = ALERT_LEVELS.find((l) => l.id === levelId);
      if (!level) return;
      const filters = [{
        meta: { alias: null, disabled: false, key: 'rule.level', negate: false, params: { gte: level.min, lte: level.max }, type: 'range', value: `${level.min} to ${level.max}` },
        query: { range: { 'rule.level': { gte: level.min, lte: level.max } } },
        $state: { store: 'appState' },
      }];
      const appState = rison.encode({ filters, index: indexPattern || 'watchflux-alerts-*' });
      const globalState = rison.encode({ time: { from: 'now-24h', to: 'now' } });
      core.application.navigateToApp('discover', { path: `#/?_g=${globalState}&_a=${appState}` });
    },
    [core.application, indexPattern]
  );

  const navigateToDiscoverAll = useCallback(() => {
    const globalState = rison.encode({ time: { from: 'now-1h', to: 'now' } });
    core.application.navigateToApp('discover', { path: `#/?_g=${globalState}` });
  }, [core.application]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  const totalAlerts = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="alertSummary__root">

      {/* ── Header ── */}
      <div className="alertSummary__topBar">
        <div className="alertSummary__topBarLeft">
          <EuiTitle size="s">
            <h2 className="alertSummary__mainTitle">Security Overview</h2>
          </EuiTitle>
          <EuiText size="xs" className="alertSummary__subtitle">
            Last 24 hours · {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
          </EuiText>
        </div>
        <div className="alertSummary__topBarRight">
          <EuiButtonEmpty size="s" iconType="refresh" onClick={fetchAll} isLoading={loadingCounts || loadingEvents}>
            Refresh
          </EuiButtonEmpty>
          <EuiButtonEmpty size="s" iconType="discoverApp" onClick={navigateToDiscoverAll}>
            View all in Discover
          </EuiButtonEmpty>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <EuiFlexGroup gutterSize="m" responsive={false} className="alertSummary__cards">
        {/* Total card */}
        <EuiFlexItem className="alertSummary__cardItem">
          <div className="alertSummary__card alertSummary__card--total" onClick={navigateToDiscoverAll} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && navigateToDiscoverAll()}>
            <div className="alertSummary__cardBar" style={{ background: 'linear-gradient(90deg, #4f8fff, #ff4f9a)' }} />
            <div className="alertSummary__cardBody">
              <span className="alertSummary__cardLevelName" style={{ color: '#e8e8ff' }}>Total</span>
              <span className="alertSummary__cardLevelRange">All levels</span>
              <div className="alertSummary__cardCount">
                {loadingCounts ? <EuiLoadingSpinner size="m" /> : (
                  <span className="alertSummary__cardNumber" style={{ color: '#4f8fff' }}>{fmt(totalAlerts)}</span>
                )}
              </div>
              <span className="alertSummary__cardAction">View all →</span>
            </div>
          </div>
        </EuiFlexItem>

        {/* Level cards */}
        {ALERT_LEVELS.map((level) => (
          <EuiFlexItem key={level.id} className="alertSummary__cardItem">
            <EuiToolTip content={`Click to view ${level.label} alerts (level ${level.min}–${level.max}) in Discover`} position="bottom">
              <div
                className={`alertSummary__card alertSummary__card--${level.id}`}
                style={{ background: level.bgColor, borderColor: level.borderColor }}
                onClick={() => navigateToDiscover(level.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigateToDiscover(level.id)}
                aria-label={`${level.label}: ${counts ? fmt(counts[level.id]) : '—'}`}
              >
                <div className="alertSummary__cardBar" style={{ background: level.color }} />
                <div className="alertSummary__cardBody">
                  <span className="alertSummary__cardLevelName" style={{ color: level.color }}>{level.label}</span>
                  <span className="alertSummary__cardLevelRange">Level {level.min}{level.min !== level.max ? `–${level.max}` : ''}</span>
                  <div className="alertSummary__cardCount">
                    {loadingCounts && !counts
                      ? <EuiLoadingSpinner size="m" />
                      : <span className="alertSummary__cardNumber" style={{ color: level.color }}>{counts ? fmt(counts[level.id]) : '—'}</span>
                    }
                  </div>
                  <span className="alertSummary__cardAction">View →</span>
                </div>
              </div>
            </EuiToolTip>
          </EuiFlexItem>
        ))}
      </EuiFlexGroup>

      <EuiSpacer size="l" />
      <EuiHorizontalRule margin="none" className="alertSummary__divider" />
      <EuiSpacer size="m" />

      {/* ── Recent Events Table ── */}
      <div className="alertEvents__section">
        <div className="alertEvents__header">
          <div>
            <EuiTitle size="xs">
              <h3 className="alertEvents__title">Recent Events</h3>
            </EuiTitle>
            <EuiText size="xs" className="alertEvents__subtitle">
              Last 15 events · past 1 hour
            </EuiText>
          </div>
          <EuiButtonEmpty size="xs" iconType="discoverApp" onClick={navigateToDiscoverAll}>
            View all
          </EuiButtonEmpty>
        </div>

        {loadingEvents ? (
          <div className="alertEvents__loading"><EuiLoadingSpinner size="l" /></div>
        ) : events.length === 0 ? (
          <div className="alertEvents__empty">
            <EuiText color="subdued" size="s" textAlign="center">No events in the last hour</EuiText>
          </div>
        ) : (
          <div className="alertEvents__tableWrapper">
            <table className="alertEvents__table">
              <thead>
                <tr>
                  <th className="alertEvents__th alertEvents__th--toggle" />
                  <th className="alertEvents__th alertEvents__th--timestamp">Timestamp</th>
                  <th className="alertEvents__th alertEvents__th--agent">Agent name</th>
                  <th className="alertEvents__th alertEvents__th--severity">Severity</th>
                  <th className="alertEvents__th alertEvents__th--description">Rule description</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const isExpanded = expandedRows.has(event.id);
                  const level = ALERT_LEVELS.find((l) => event.ruleLevel >= l.min && event.ruleLevel <= l.max);
                  return (
                    <Fragment key={event.id}>
                      <tr
                        className={`alertEvents__row ${isExpanded ? 'alertEvents__row--expanded' : ''}`}
                        style={{ borderLeft: `3px solid ${level?.color || 'transparent'}` }}
                      >
                        {/* Toggle */}
                        <td className="alertEvents__td alertEvents__td--toggle">
                          <EuiToolTip content={isExpanded ? 'Collapse details' : 'Expand details'}>
                            <EuiButtonIcon
                              iconType={isExpanded ? 'arrowDown' : 'arrowRight'}
                              onClick={() => toggleRow(event.id)}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              size="xs"
                              color="text"
                              className="alertEvents__toggleBtn"
                            />
                          </EuiToolTip>
                        </td>

                        {/* Timestamp */}
                        <td className="alertEvents__td alertEvents__td--timestamp">
                          <span className="alertEvents__tsText">{formatTs(event.timestamp)}</span>
                        </td>

                        {/* Agent name */}
                        <td className="alertEvents__td alertEvents__td--agent">
                          <span className="alertEvents__agentBadge">
                            <span className="alertEvents__agentDot" />
                            {event.agentName}
                          </span>
                        </td>

                        {/* Severity */}
                        <td className="alertEvents__td alertEvents__td--severity">
                          <SeverityBadge level={event.ruleLevel} />
                        </td>

                        {/* Rule description */}
                        <td className="alertEvents__td alertEvents__td--description">
                          <span className="alertEvents__descText">{event.ruleDescription}</span>
                        </td>
                      </tr>

                      {/* Expanded details row */}
                      {isExpanded && (
                        <tr className="alertEvents__detailsRow">
                          <td colSpan={5} className="alertEvents__detailsTd">
                            <EventDetails event={event} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
