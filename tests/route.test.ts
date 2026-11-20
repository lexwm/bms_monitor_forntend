import { expect, it } from 'vitest';
import { historyHash, parseRoute } from '../src/route';

it('parses hash routes and falls back without inventing pages', () => {
 expect(parseRoute('')).toEqual({ page: 'overview' });
 expect(parseRoute('#overview')).toEqual({ page: 'overview' });
 expect(parseRoute('#data-details')).toEqual({ page: 'overview' });
 expect(parseRoute('#configuration')).toEqual({ page: 'configuration' });
 expect(parseRoute('#history')).toEqual({ page: 'history', tab: 'overview', cell: null });
 expect(parseRoute('#history/cells')).toEqual({ page: 'history', tab: 'cells', cell: null });
 expect(parseRoute('#history/cells/8')).toEqual({ page: 'history', tab: 'cells', cell: 8 });
 expect(parseRoute('#history/cells/9')).toEqual({ page: 'history', tab: 'cells', cell: null });
 expect(parseRoute('#history/cells/0')).toEqual({ page: 'history', tab: 'cells', cell: null });
 expect(parseRoute('#history/energy')).toEqual({ page: 'history', tab: 'energy', cell: null });
 expect(parseRoute('#history/events')).toEqual({ page: 'history', tab: 'events', cell: null });
 expect(parseRoute('#history/unknown')).toEqual({ page: 'history', tab: 'overview', cell: null });
 expect(parseRoute('#history/events/1')).toEqual({ page: 'history', tab: 'overview', cell: null });
});
it('builds links back to the same routes', () => {
 expect(historyHash('overview')).toBe('#history');
 expect(historyHash('cells', 3)).toBe('#history/cells/3');
 expect(historyHash('events')).toBe('#history/events');
});
