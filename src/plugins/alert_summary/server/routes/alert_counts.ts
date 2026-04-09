/*
 * Alert Summary — server route
 * Queries OpenSearch for alert counts by rule.level range
 */
import { IRouter } from 'opensearch-dashboards/server';
import { schema } from '@osd/config-schema';
import { API_ROUTE, ALERT_LEVELS, INDEX_PATTERN } from '../../common';

export function registerAlertCountsRoute(router: IRouter) {
  router.get(
    {
      path: API_ROUTE,
      validate: {
        query: schema.object({
          index: schema.maybe(schema.string()),
          timeFrom: schema.maybe(schema.string()),
          timeTo: schema.maybe(schema.string()),
        }),
      },
    },
    async (context, request, response) => {
      const { index, timeFrom, timeTo } = request.query;
      const indexPattern = index || INDEX_PATTERN;

      try {
        const client = context.core.opensearch.client;

        // Build aggregation query — one bucket per severity level
        const aggs: Record<string, any> = {};
        ALERT_LEVELS.forEach((level) => {
          aggs[level.id] = {
            filter: {
              range: {
                'rule.level': {
                  gte: level.min,
                  lte: level.max,
                },
              },
            },
          };
        });

        const query: any = {
          bool: {
            must: [],
            filter: [],
          },
        };

        // Add time range if provided (using timestamp field)
        if (timeFrom && timeTo) {
          query.bool.filter.push({
            range: {
              timestamp: {
                gte: timeFrom,
                lte: timeTo,
              },
            },
          });
        }

        const { body } = await client.asCurrentUser.search({
          index: indexPattern,
          body: {
            size: 0,
            query,
            aggs,
          },
        });

        const counts: Record<string, number> = {};
        ALERT_LEVELS.forEach((level) => {
          counts[level.id] = (body.aggregations as any)?.[level.id]?.doc_count ?? 0;
        });

        return response.ok({
          body: {
            counts,
            total: Object.values(counts).reduce((a, b) => a + b, 0),
          },
        });
      } catch (err) {
        // If index doesn't exist yet return zeros gracefully
        const counts: Record<string, number> = {};
        ALERT_LEVELS.forEach((level) => { counts[level.id] = 0; });
        return response.ok({
          body: { counts, total: 0, error: err.message },
        });
      }
    }
  );
}
