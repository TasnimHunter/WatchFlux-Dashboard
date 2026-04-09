/*
 * Alert Summary — recent events route with aggregations
 */
import { IRouter } from 'opensearch-dashboards/server';
import { schema } from '@osd/config-schema';
import { INDEX_PATTERN, ALERT_LEVELS } from '../../common';

export function registerAlertEventsRoute(router: IRouter) {
  router.get(
    {
      path: '/api/alert_summary/events',
      validate: {
        query: schema.object({
          index: schema.maybe(schema.string()),
          size: schema.maybe(schema.number()),
          hours: schema.maybe(schema.number()),
          timezone: schema.maybe(schema.string()),
        }),
      },
    },
    async (context, request, response) => {
      const { index, size = 15, hours = 24, timezone = '+06:00' } = request.query;
      const indexPattern = index || INDEX_PATTERN;

      try {
        const client = context.core.opensearch.client;
        
        const { body } = await client.asCurrentUser.search({
          index: indexPattern,
          body: {
            size,
            sort: [{ timestamp: { order: 'desc' } }],
            query: {
              bool: {
                filter: [
                  {
                    range: {
                      timestamp: {
                        gte: `now-${hours}h`,
                        lte: 'now',
                      },
                    },
                  },
                ],
              },
            },
            aggs: {
              // Timeline aggregation: bucket by hour with timezone
              timeline: {
                date_histogram: {
                  field: 'timestamp',
                  fixed_interval: '1h',
                  format: 'yyyy-MM-dd HH:mm:ss',
                  time_zone: timezone,
                  min_doc_count: 0,
                  extended_bounds: {
                    min: `now-${hours}h`,
                    max: 'now',
                  },
                },
                aggs: {
                  levels: {
                    filters: {
                      filters: {
                        critical: { range: { 'rule.level': { gte: 15, lte: 15 } } },
                        high: { range: { 'rule.level': { gte: 12, lte: 14 } } },
                        medium: { range: { 'rule.level': { gte: 7, lte: 11 } } },
                        low: { range: { 'rule.level': { gte: 1, lte: 6 } } },
                      },
                    },
                  },
                },
              },
              // Severity distribution
              severity_distribution: {
                filters: {
                  filters: {
                    critical: { range: { 'rule.level': { gte: 15, lte: 15 } } },
                    high: { range: { 'rule.level': { gte: 12, lte: 14 } } },
                    medium: { range: { 'rule.level': { gte: 7, lte: 11 } } },
                    low: { range: { 'rule.level': { gte: 1, lte: 6 } } },
                  },
                },
              },
              // Top agents
              top_agents: {
                terms: {
                  field: 'agent.name',
                  size: 10,
                  order: { _count: 'desc' },
                },
              },
            },
            _source: [
              'timestamp',
              'agent.id',
              'agent.name',
              'rule.description',
              'rule.level',
              'rule.id',
              'rule.groups',
              'location',
              'full_log',
              'data.srcip',
              'manager.name',
            ],
          },
        });

        const events = (body.hits?.hits || []).map((hit: any) => ({
          id: hit._id,
          timestamp: hit._source?.timestamp,
          agentId: hit._source?.agent?.id || '—',
          agentName: hit._source?.agent?.name || '—',
          agentIp: hit._source?.data?.srcip || '—',
          ruleDescription: hit._source?.rule?.description || '—',
          ruleLevel: hit._source?.rule?.level,
          ruleId: hit._source?.rule?.id,
          ruleGroups: hit._source?.rule?.groups || [],
          location: hit._source?.location,
          fullLog: hit._source?.full_log,
          managerName: hit._source?.manager?.name,
          raw: hit._source,
        }));

        // Process timeline data
        const timelineBuckets = body.aggregations?.timeline?.buckets || [];
        const timeline = timelineBuckets.map((bucket: any) => ({
          timestamp: bucket.key_as_string,
          total: bucket.doc_count,
          critical: bucket.levels?.buckets?.critical?.doc_count || 0,
          high: bucket.levels?.buckets?.high?.doc_count || 0,
          medium: bucket.levels?.buckets?.medium?.doc_count || 0,
          low: bucket.levels?.buckets?.low?.doc_count || 0,
        }));

        // Process severity distribution
        const severityBuckets = body.aggregations?.severity_distribution?.buckets || {};
        const severityDistribution = {
          critical: severityBuckets.critical?.doc_count || 0,
          high: severityBuckets.high?.doc_count || 0,
          medium: severityBuckets.medium?.doc_count || 0,
          low: severityBuckets.low?.doc_count || 0,
        };

        // Process top agents
        const agentBuckets = body.aggregations?.top_agents?.buckets || [];
        const topAgents = agentBuckets.map((bucket: any) => ({
          name: bucket.key,
          count: bucket.doc_count,
        }));

        return response.ok({ 
          body: { 
            events, 
            total: body.hits?.total?.value || 0,
            timeline,
            severityDistribution,
            topAgents,
          } 
        });
      } catch (err) {
        return response.ok({ 
          body: { 
            events: [], 
            total: 0, 
            timeline: [],
            severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
            topAgents: [],
            error: err.message 
          } 
        });
      }
    }
  );
}
