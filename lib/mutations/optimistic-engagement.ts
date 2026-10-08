type Engagement = { active: boolean; count: number }

/** Replaying a desired state over refreshed server props must not count twice. */
export function optimisticEngagement(current: Engagement, active: boolean): Engagement {
  return {
    active,
    count: Math.max(0, current.count + Number(active) - Number(current.active)),
  }
}
