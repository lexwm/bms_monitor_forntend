import { useId } from 'react';
import { format } from '../format';

export function SocIndicator({ value, mode }: { value: number | null | undefined; mode: string }) {
 const id = useId();
 const paint = (name: string) => `url(#${id}-${name})`;
 const arc = `${(value ?? 0) * 5 / 6} 100`;
 const text = format(value, 0);
 const compact = value != null && value > 0 && value < 1;
 return <div className="dial" role="img" aria-describedby={`${id}-mode`} aria-label={value == null ? 'Заряд невідомий' : `Заряд ${format(value, 0)} відсотків`}>
  <svg viewBox="0 0 400 400" aria-hidden="true"><defs>
   <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#50565a"/><stop offset=".17" stopColor="#d7d8d3"/><stop offset=".32" stopColor="#818784"/><stop offset=".53" stopColor="#252a2c"/><stop offset=".8" stopColor="#484d4f"/><stop offset="1" stopColor="#b7b9b2"/></linearGradient>
   <linearGradient id={`${id}-gold`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#71572f"/><stop offset=".35" stopColor="#b69c60"/><stop offset=".7" stopColor="#f0dfad"/><stop offset="1" stopColor="#a7894d"/></linearGradient>
   <radialGradient id={`${id}-face`} cx=".34" cy=".23" r=".86"><stop stopColor="#323638"/><stop offset=".58" stopColor="#1c2022"/><stop offset="1" stopColor="#0d1012"/></radialGradient>
   <linearGradient id={`${id}-glass`} x1=".1" y1="0" x2=".7" y2="1"><stop stopColor="#fff" stopOpacity=".16"/><stop offset=".65" stopColor="#fff" stopOpacity=".015"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
   <filter id={`${id}-shadow`} x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="11" stdDeviation="10" floodOpacity=".65"/></filter>
   <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
   <clipPath id={`${id}-clip`}><circle cx="200" cy="200" r="137"/></clipPath>
  </defs>
  <circle cx="200" cy="200" r="147" fill={paint('metal')} filter={paint('shadow')}/>
  <circle cx="200" cy="200" r="143" fill={paint('face')}/>
  <g clipPath={paint('clip')}><path d="M60 70 Q200 25 340 82 L340 158 Q190 99 60 181Z" fill={paint('glass')}/></g>
  <circle cx="200" cy="200" r="164" fill="none" stroke="#33383a" strokeWidth="5" pathLength="100" strokeDasharray="83.3333 100" transform="rotate(120 200 200)" strokeLinecap="round"/>
  <g visibility={value == null || value === 0 ? 'hidden' : 'visible'}>
   <circle className="soc-arc" cx="200" cy="200" r="164" fill="none" stroke="#d4b775" strokeWidth="8" pathLength="100" strokeDasharray={arc} transform="rotate(120 200 200)" opacity=".28" filter={paint('glow')} strokeLinecap="round"/>
   <circle className="soc-arc" cx="200" cy="200" r="164" fill="none" stroke={paint('gold')} strokeWidth="5" pathLength="100" strokeDasharray={arc} transform="rotate(120 200 200)" strokeLinecap="round"/>
  </g>
  <circle cx="200" cy="200" r="174" fill="none" stroke="#aab2b1" strokeOpacity=".2" strokeWidth=".7" pathLength="100" strokeDasharray="83.3333 100" transform="rotate(120 200 200)"/>
  </svg>
  <div className="dial-center" aria-hidden="true"><span className="dial-label">РІВЕНЬ ЗАРЯДУ</span><div className="soc"><span className="reading-update" key={value}><span style={{ fontSize: compact ? `${3 / (text.length + 1)}em` : undefined }}>{text}</span></span><small>%</small></div><span className="mode-label">{mode}</span></div>
  <span className="sr-only" id={`${id}-mode`}>{mode}</span>
 </div>;
}
