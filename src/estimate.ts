// Rough time to a full or an empty battery at the present current.
// Only a linear projection of the battery's own counters; it is not a forecast of the load.
export type Estimate = { target: 'full' | 'empty'; minutes: number };

export function estimateTime(currentA: number | null | undefined, remainingAh: number | null | undefined, capacityAh: number | null | undefined): Estimate | null {
 if (currentA == null || remainingAh == null || !Number.isFinite(currentA) || !Number.isFinite(remainingAh) || currentA === 0 || remainingAh < 0) return null;
 if (currentA < 0) return { target: 'empty', minutes: Math.round(remainingAh / -currentA * 60) };
 if (capacityAh == null || !Number.isFinite(capacityAh) || capacityAh < remainingAh) return null;
 return { target: 'full', minutes: Math.round((capacityAh - remainingAh) / currentA * 60) };
}
