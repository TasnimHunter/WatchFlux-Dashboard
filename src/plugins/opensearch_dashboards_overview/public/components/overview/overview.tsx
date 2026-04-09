/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { FC, useState, useEffect, useCallback, Fragment } from 'react';
import {
  EuiFlexGroup,
  EuiFlexItem,
  EuiTitle,
  EuiText,
  EuiSpacer,
  EuiHorizontalRule,
  EuiLoadingSpinner,
  EuiButtonEmpty,
  EuiButtonIcon,
  EuiToolTip,
  EuiBadge,
  EuiCodeBlock,
  EuiDescriptionList,
  EuiToken,
  EuiCard,
  EuiLoadingChart,
} from '@elastic/eui';
import rison from 'rison-node';
import { CoreStart, Logos } from 'opensearch-dashboards/public';
import {
  RedirectAppLinks,
  useOpenSearchDashboards,
  OverviewPageHeader,
  OverviewPageFooter,
} from '../../../../../../src/plugins/opensearch_dashboards_react/public';
import { FetchResult } from '../../../../../../src/plugins/newsfeed/public';
import {
  FeatureCatalogueEntry,
  FeatureCatalogueSolution,
} from '../../../../../../src/plugins/home/public';
import { PLUGIN_ID, PLUGIN_PATH } from '../../../common';
import './overview.scss';
import { AppPluginStartDependencies } from '../../types';

import { EuiPanel, EuiLoadingChart } from '@elastic/eui'; // Add EuiPanel if not already imported
import { TimelineChart, SeverityDistribution, TopAgentsChart } from './charts';


// ── Constants ─────────────────────────────────────────
const INDEX_PATTERN = 'watchflux-alerts-*';
const COUNTS_API = '/api/alert_summary/counts';
const EVENTS_API = '/api/alert_summary/events';

const ALERT_LEVELS = [
  { id: 'critical', label: 'Critical', min: 15, max: 15, color: '#ff4f4f', bgColor: 'rgba(255,79,79,0.08)', borderColor: 'rgba(255,79,79,0.25)' },
  { id: 'high',     label: 'High',     min: 12, max: 14, color: '#ffb547', bgColor: 'rgba(255,181,71,0.08)', borderColor: 'rgba(255,181,71,0.25)' },
  { id: 'medium',   label: 'Medium',   min: 7,  max: 11, color: '#fde047', bgColor: 'rgba(253,224,71,0.08)', borderColor: 'rgba(253,224,71,0.25)' },
  { id: 'low',      label: 'Low',      min: 1,  max: 6,  color: '#00e5a0', bgColor: 'rgba(0,229,160,0.08)',  borderColor: 'rgba(0,229,160,0.25)'  },
] as const;

// ── Types ──────────────────────────────────────────────
interface AlertCounts { [key: string]: number; }

interface AlertEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  agentIp: string;
  ruleDescription: string;
  ruleLevel: number;
  ruleId: string;
  ruleGroups: string[];
  location: string;
  fullLog: string;
  managerName: string;
}

interface Props {
  newsFetchResult: FetchResult | null | void;
  solutions: FeatureCatalogueSolution[];
  features: FeatureCatalogueEntry[];
  logos: Logos;
}

// ── Helpers ────────────────────────────────────────────
const getLevelForValue = (level: number) =>
  ALERT_LEVELS.find((l) => level >= l.min && level <= l.max);

const formatTs = (ts: string) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return ts; }
};

const fmtCount = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
};

// ── Severity badge ─────────────────────────────────────
const SeverityBadge = ({ level }: { level: number }) => {
  const lvl = getLevelForValue(level);
  if (!lvl) return <EuiBadge>{level ?? '—'}</EuiBadge>;
  return (
    <EuiBadge style={{
      background: lvl.bgColor,
      color: lvl.color,
      border: `1px solid ${lvl.borderColor}`,
      fontWeight: 700,
      fontSize: 11,
    }}>
      {lvl.label} · {level}
    </EuiBadge>
  );
};

// ── Event details expanded panel ───────────────────────
const EventDetails = ({ event }: { event: AlertEvent }) => (
  <div className="osdOverview__detailsPanel">
    <EuiFlexGroup gutterSize="xl" responsive={false}>
      <EuiFlexItem grow={false} style={{ minWidth: 300 }}>
        <EuiDescriptionList
          type="column"
          columnWidths={[1, 2]}
          className="osdOverview__detailsList"
          listItems={[
            { title: 'Timestamp',  description: event.timestamp || '—' },
            { title: 'Agent',      description: event.agentName || '—' },
            { title: 'Rule ID',    description: event.ruleId || '—' },
            { title: 'Rule level', description: String(event.ruleLevel ?? '—') },
            { title: 'Groups',     description: (event.ruleGroups || []).join(', ') || '—' },
            { title: 'Manager',    description: event.managerName || '—' },
            { title: 'Location',   description: event.location || '—' },
          ]}
        />
      </EuiFlexItem>
      {event.fullLog && (
        <EuiFlexItem>
          <EuiText size="xs" className="osdOverview__detailsLabel">Full log</EuiText>
          <EuiCodeBlock language="text" fontSize="s" paddingSize="s" isCopyable>
            {event.fullLog}
          </EuiCodeBlock>
        </EuiFlexItem>
      )}
    </EuiFlexGroup>
  </div>
);

// ── Main Overview component ────────────────────────────
export const Overview: FC<Props> = ({ solutions, features, logos }) => {
  const {
    services: { http, application, uiSettings },
  } = useOpenSearchDashboards<CoreStart & AppPluginStartDependencies>();

  const addBasePath = http.basePath.prepend;
  const IS_DARK_THEME = uiSettings.get('theme:darkMode');

  const [counts, setCounts]           = useState<AlertCounts | null>(null);
  const [events, setEvents]           = useState<AlertEvent[]>([]);
  const [loadingCounts, setLCounts]   = useState(true);
  const [loadingEvents, setLEvents]   = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedRows, setExpanded]   = useState<Set<string>>(new Set());

  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [severityDistribution, setSeverityDistribution] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [topAgents, setTopAgents] = useState<any[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  // ── Fetch counts ───────────────────────────────────
  const fetchEvents = useCallback(async () => {
    setLEvents(true);
    setLoadingCharts(true);
    try {
      const res: any = await http.get(EVENTS_API, { query: { size: 15, hours: 24 } });
      console.log('Events API response:', res);
      console.log('Events array length:', res.events?.length);
      if (res.events && res.events.length > 0) {
        console.log('First event:', res.events[0]);
      }
      setEvents(res.events || []);
      setTimelineData(res.timeline || []);
      setSeverityDistribution(res.severityDistribution || { critical: 0, high: 0, medium: 0, low: 0 });
      setTopAgents(res.topAgents || []);
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally { 
      setLEvents(false);
      setLoadingCharts(false);
    }
  }, [http]);


  // ── Fetch recent events ────────────────────────────


  const fetchCounts = useCallback(async () => {
    setLCounts(true);
    try {
      const res: any = await http.get(COUNTS_API);
      setCounts(res.counts);
      setLastUpdated(new Date());
    } catch {
      setCounts({ critical: 0, high: 0, medium: 0, low: 0 });
    } finally { setLCounts(false); }
  }, [http]);

  const fetchAll = useCallback(() => { fetchCounts(); fetchEvents(); }, [fetchCounts, fetchEvents]);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 30000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // ── Navigate to Discover with filter (FIXED) ──────────────
  const toDiscover = useCallback((levelId?: string) => {
    const level = levelId ? ALERT_LEVELS.find((l) => l.id === levelId) : null;
    const filters = level ? [{
      meta: { alias: null, disabled: false, key: 'rule.level', negate: false,
              params: { gte: level.min, lte: level.max }, type: 'range' },
      query: { range: { 'rule.level': { gte: level.min, lte: level.max } } },
      $state: { store: 'appState' },
    }] : [];
    
    const appState = rison.encode({ filters });
    const globalState = rison.encode({ time: { from: 'now-24h', to: 'now' } });
    
    // Fixed: Use data-explorer app with correct path format
    application.navigateToApp('data-explorer', { 
      path: `discover#/?_g=${globalState}&_a=${appState}`
    });
  }, [application]);

  const toggleRow = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  // ── App quick-access cards (dashboard, discover) ──
  const getSolutionGraphicURL = (solutionId: string) =>
    `/plugins/${PLUGIN_ID}/assets/solutions_${solutionId}_${IS_DARK_THEME ? 'dark' : 'light'}_2x.png`;

  return (
    <main className="osdOverviewWrapper osdOverview__customWrapper">

      {/* ── Page header ───────────────────────────── */}
      <OverviewPageHeader
        addBasePath={addBasePath}
        hideToolbar={false}
        showIcon
        title="Alerts Overview"
        logos={logos}
      />

      <div className="osdOverviewContent">

        {/* ═══════════════════════════════════════════
            SECTION 1 — Alert summary cards
        ══════════════════════════════════════════════ */}
        <section className="osdOverview__section">
          <div className="osdOverview__sectionHeader">
            <div>
              <EuiTitle size="s">
                <h2 className="osdOverview__sectionTitle">Alert Summary</h2>
              </EuiTitle>
              <EuiText size="xs" className="osdOverview__sectionSubtitle">
                Last 24 hours
                {lastUpdated && ` · Updated ${lastUpdated.toLocaleTimeString()}`}
              </EuiText>
            </div>
            <div className="osdOverview__sectionActions">
              <EuiButtonEmpty size="s" iconType="refresh" onClick={fetchAll}
                isLoading={loadingCounts || loadingEvents}>
                Refresh
              </EuiButtonEmpty>
              <EuiButtonEmpty size="s" iconType="discoverApp" onClick={() => toDiscover()}>
                View all
              </EuiButtonEmpty>
            </div>
          </div>

          <EuiFlexGroup gutterSize="m" responsive={false} className="osdOverview__cards">

            {/* Total card */}
            <EuiFlexItem>
              <div className="osdOverview__card osdOverview__card--total"
                onClick={() => toDiscover()} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && toDiscover()}
                aria-label="Total alerts — view all in Discover">
                <div className="osdOverview__cardBar osdOverview__cardBar--gradient" />
                <div className="osdOverview__cardBody">
                  <span className="osdOverview__cardLabel" style={{ color: '#e8e8ff' }}>Total</span>
                  <span className="osdOverview__cardRange">All levels</span>
                  <div className="osdOverview__cardCount">
                    {loadingCounts
                      ? <EuiLoadingSpinner size="m" />
                      : <span className="osdOverview__cardNumber" style={{ color: '#4f8fff' }}>{fmtCount(total)}</span>
                    }
                  </div>
                  <span className="osdOverview__cardCta">View all →</span>
                </div>
              </div>
            </EuiFlexItem>

            {/* Level cards */}
            {ALERT_LEVELS.map((level) => (
              <EuiFlexItem key={level.id}>
                <EuiToolTip content={`Click to view ${level.label} alerts (level ${level.min}–${level.max}) in Discover`} position="bottom">
                  <div
                    className={`osdOverview__card osdOverview__card--${level.id}`}
                    style={{ background: level.bgColor, borderColor: level.borderColor }}
                    onClick={() => toDiscover(level.id)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toDiscover(level.id)}
                    aria-label={`${level.label}: ${counts ? fmtCount(counts[level.id]) : '—'}`}
                  >
                    <div className="osdOverview__cardBar" style={{ background: level.color }} />
                    <div className="osdOverview__cardBody">
                      <span className="osdOverview__cardLabel" style={{ color: level.color }}>{level.label}</span>
                      <span className="osdOverview__cardRange">
                        Level {level.min}{level.min !== level.max ? `–${level.max}` : ''}
                      </span>
                      <div className="osdOverview__cardCount">
                        {loadingCounts && !counts
                          ? <EuiLoadingSpinner size="m" />
                          : <span className="osdOverview__cardNumber" style={{ color: level.color }}>
                              {counts ? fmtCount(counts[level.id]) : '—'}
                            </span>
                        }
                      </div>
                      <span className="osdOverview__cardCta">View →</span>
                    </div>
                  </div>
                </EuiToolTip>
              </EuiFlexItem>
            ))}
          </EuiFlexGroup>
        </section>

        <EuiHorizontalRule margin="l" className="osdOverview__divider" />

                {/* ═══════════════════════════════════════════
            SECTION 2 — Charts
        ══════════════════════════════════════════════ */}
        <div>
          <EuiTitle size="s">
            <h2 className="osdOverview__sectionTitle">Summary Charts</h2>
          </EuiTitle>
        </div>
        
        <EuiSpacer size="m" />

        {loadingCharts ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <EuiLoadingChart size="xl" />
            <EuiSpacer size="s" />
            <EuiText color="subdued" size="s">Loading charts...</EuiText>
          </div>
        ) : (
          <EuiFlexGroup gutterSize="l" style={{ marginBottom: '24px' }}>
            <EuiFlexItem style={{ minHeight: '280px' }}>
              <TimelineChart data={timelineData} hours={24} />
            </EuiFlexItem>
            <EuiFlexItem style={{ minHeight: '280px' }}>
              <SeverityDistribution data={severityDistribution} />
            </EuiFlexItem>
            <EuiFlexItem style={{ minHeight: '280px' }}>
              <TopAgentsChart data={topAgents} />
            </EuiFlexItem>
          </EuiFlexGroup>
        )}

        {/* ═══════════════════════════════════════════
            SECTION 3 — Recent events table
        ══════════════════════════════════════════════ */}
        <section className="osdOverview__section">
          <div className="osdOverview__sectionHeader">
            <div>
              <EuiTitle size="s">
                <h2 className="osdOverview__sectionTitle">Recent Events</h2>
              </EuiTitle>
              <EuiText size="xs" className="osdOverview__sectionSubtitle">
                Last 15 events · past 24 hour
              </EuiText>
            </div>
            <EuiButtonEmpty size="s" iconType="discoverApp" onClick={() => toDiscover()}>
              View all
            </EuiButtonEmpty>
          </div>

          {loadingEvents ? (
            <div className="osdOverview__tableLoading">
              <EuiLoadingSpinner size="l" />
            </div>
          ) : events.length === 0 ? (
            <div className="osdOverview__tableEmpty">
              <EuiText color="subdued" size="s" textAlign="center">
                No events in the last hour. Make sure <code>{INDEX_PATTERN}</code> index exists.
              </EuiText>
            </div>
          ) : (
            <div className="osdOverview__tableWrapper">
              <table className="osdOverview__table">
                <thead>
                  <tr>
                    <th className="osdOverview__th osdOverview__th--toggle" />
                    <th className="osdOverview__th osdOverview__th--ts">Timestamp</th>
                    <th className="osdOverview__th osdOverview__th--agent-id">Agent ID</th>
                    <th className="osdOverview__th osdOverview__th--agent">Agent name</th>
                    <th className="osdOverview__th osdOverview__th--agent-ip">Agent IP</th>
                    <th className="osdOverview__th osdOverview__th--sev">Severity</th>
                    <th className="osdOverview__th osdOverview__th--desc">Rule description</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const isExpanded = expandedRows.has(event.id);
                    const lvl = getLevelForValue(event.ruleLevel);
                    return (
                      <Fragment key={event.id}>
                        <tr
                          className={`osdOverview__row${isExpanded ? ' osdOverview__row--open' : ''}`}
                          style={{ borderLeft: `3px solid ${lvl?.color || 'transparent'}` }}
                        >
                          {/* Toggle */}
                          <td className="osdOverview__td osdOverview__td--toggle">
                            <EuiToolTip content={isExpanded ? 'Collapse' : 'Expand details'}>
                              <EuiButtonIcon
                                iconType={isExpanded ? 'arrowDown' : 'arrowRight'}
                                onClick={() => toggleRow(event.id)}
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                size="xs"
                                color="text"
                                className="osdOverview__toggleBtn"
                              />
                            </EuiToolTip>
                          </td>
                          {/* Timestamp */}
                          <td className="osdOverview__td osdOverview__td--ts">
                            <span className="osdOverview__tsText">{formatTs(event.timestamp)}</span>
                          </td>

                          {/* Agent ID */}
                          <td className="osdOverview__td osdOverview__td--agent-id">
                            <span className="osdOverview__agentIdBadge">{event.agentId}</span>
                          </td>

                          {/* Agent */}
                          <td className="osdOverview__td osdOverview__td--agent">
                            <span className="osdOverview__agentBadge">
                              <span className="osdOverview__agentDot" />
                              {event.agentName}
                            </span>
                          </td>

                          {/* Agent IP - New column */}
                          <td className="osdOverview__td osdOverview__td--agent-ip">
                            <code className="osdOverview__ipCode">{event.agentIp}</code>
                          </td>

                          {/* Severity */}
                          <td className="osdOverview__td osdOverview__td--sev">
                            <SeverityBadge level={event.ruleLevel} />
                          </td>
                          {/* Description */}
                          <td className="osdOverview__td osdOverview__td--desc">
                            <span className="osdOverview__descText">{event.ruleDescription}</span>
                          </td>
                        </tr>

                        {/* Expanded details */}
                        {isExpanded && (
                          <tr className="osdOverview__detailsRow">
                            <td colSpan={7} className="osdOverview__detailsTd">
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
        </section>

        <EuiHorizontalRule margin="l" className="osdOverview__divider" />

        {/* ═══════════════════════════════════════════
            SECTION 3 — Quick access to OSD apps
        ══════════════════════════════════════════════ */}
        {solutions.length > 0 && (
          <section className="osdOverview__section">
            <EuiTitle size="s">
              <h2 className="osdOverview__sectionTitle">Do more with OpenSearch</h2>
            </EuiTitle>
            <EuiSpacer size="m" />
            <EuiFlexGroup gutterSize="m">
              {solutions.map(({ id, title, description, icon, path }) => (
                <EuiFlexItem key={id} style={{ maxWidth: 220 }}>
                  <RedirectAppLinks application={application}>
                    <EuiCard
                      description={description || ''}
                      href={addBasePath(path)}
                      icon={<EuiToken fill="light" iconType={icon} shape="circle" size="l" />}
                      image={addBasePath(getSolutionGraphicURL(id))}
                      title={title}
                      titleElement="h3"
                      titleSize="xs"
                    />
                  </RedirectAppLinks>
                </EuiFlexItem>
              ))}
            </EuiFlexGroup>
          </section>
        )}

        <EuiHorizontalRule margin="xl" aria-hidden="true" />
        <OverviewPageFooter addBasePath={addBasePath} path={PLUGIN_PATH} />
      </div>
    </main>
  );
};