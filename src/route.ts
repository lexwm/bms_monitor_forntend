// Pages are addressed by the hash only, so the static server needs no routes of its own.
export type HistoryTab = 'overview' | 'cells' | 'energy' | 'events';
export type Route = { page: 'overview' } | { page: 'configuration' } | { page: 'history'; tab: HistoryTab; cell: number | null };

export function parseRoute(hash: string): Route {
 const parts = hash.replace(/^#/, '').split('/');
 if (parts.length === 1 && parts[0] === 'configuration') return { page: 'configuration' };
 if (parts[0] !== 'history') return { page: 'overview' };
 const [, tab, cell] = parts;
 if (tab === 'cells' && parts.length === 3 && cell !== undefined && /^[1-8]$/.test(cell)) return { page: 'history', tab, cell: Number(cell) };
 if ((tab === 'cells' || tab === 'energy' || tab === 'events') && parts.length === 2) return { page: 'history', tab, cell: null };
 return { page: 'history', tab: tab === 'cells' ? 'cells' : 'overview', cell: null };
}

export const historyHash = (tab: HistoryTab, cell: number | null = null) => tab === 'overview' ? '#history' : `#history/${tab}${cell === null ? '' : `/${cell}`}`;
