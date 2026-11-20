// Lit only for an important episode this browser has not seen; the state is also given as text.
// data-ready marks that the shown state comes from a finished server answer.
export function Bell({ lit, ready }: { lit: boolean; ready: boolean }) {
 return <a className={`bell${lit ? ' lit' : ''}`} href="#history/events" title="Журнал подій" data-testid="bell" data-ready={ready}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/></svg>
  {lit && <i className="bell-dot" aria-hidden="true"/>}
  <span className="sr-only">Журнал подій{lit && <>. Є нові важливі події</>}</span>
 </a>;
}
