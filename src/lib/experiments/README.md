# A/B Testing & Experimentation Framework

Complete A/B testing infrastructure for FiskAI. Enables controlled feature experimentation with statistical analysis, sticky user assignments, and PostHog integration.

**Fixes:** GitHub Issue #292

## Features

- **Experiment Management**: Create, start, pause, and complete experiments via API
- **User Assignment**: Consistent hashing for sticky sessions (users always see same variant)
- **Statistical Analysis**: Chi-square tests, p-values, confidence intervals
- **Event Tracking**: Track exposures, conversions, and custom events
- **PostHog Integration**: Automatic tracking of experiment enrollment and exposure
- **React Hooks**: Easy-to-use hooks for client-side experiments
- **Admin Dashboard**: View metrics, analyze results, declare winners

## Architecture

### Database Schema

```prisma
model Experiment {
  id             String           @id
  name           String           @unique
  status         ExperimentStatus // DRAFT, RUNNING, PAUSED, COMPLETED, CANCELLED
  hypothesis     String?
  successMetric  String?
  trafficPercent Int              @default(100)
  startDate      DateTime?
  endDate        DateTime?
  variants       ExperimentVariant[]
  assignments    ExperimentAssignment[]
  events         ExperimentEvent[]
}

model ExperimentVariant {
  name        String // e.g., "control", "variant_a"
  weight      Int    // Traffic percentage (must sum to 100)
  config      Json?  // Variant-specific configuration
}

model ExperimentAssignment {
  userId      String
  variantId   String
  assignedAt  DateTime
  exposedAt   DateTime? // When user first saw the variant
  convertedAt DateTime? // When user completed success metric
}

model ExperimentEvent {
  eventType String // "view", "click", "conversion", "custom"
  eventName String
  properties Json?
  timestamp DateTime
}
```

### User Assignment Algorithm

1. **Traffic Inclusion**: Hash `userId:experimentId:traffic` → check if < trafficPercent
2. **Variant Selection**: Hash `userId:experimentId:variant` → select based on weights
3. **Sticky Sessions**: Assignment stored in DB, always returns same variant
4. **Consistent Hashing**: Same user always gets same variant across sessions

## Usage

### 1. Create an Experiment

```typescript
import { createExperiment } from "@/lib/experiments"

const experiment = await createExperiment({
  name: "new-pricing-page",
  description: "Test new pricing page design",
  hypothesis: "New pricing page will increase conversions by 15%",
  successMetric: "signup_completed",
  trafficPercent: 50, // Only 50% of users included
  variants: [
    { name: "control", weight: 50, config: { showOldPricing: true } },
    { name: "treatment", weight: 50, config: { showNewPricing: true } },
  ],
})

// Start the experiment
await startExperiment(experiment.id)
```

### 2. Use in React Components

```tsx
import { useExperiment, Variant } from "@/lib/experiments/hooks"

function PricingPage() {
  const { variant, config, loading } = useExperiment("new-pricing-page")

  if (loading) return <div>Loading...</div>

  return (
    <div>
      <Variant experimentId="new-pricing-page" variant="control">
        <OldPricingUI />
      </Variant>

      <Variant experimentId="new-pricing-page" variant="treatment">
        <NewPricingUI />
      </Variant>
    </div>
  )
}
```

### 3. Track Events

```typescript
import { trackConversion } from "@/lib/experiments"

// When user completes signup
await trackConversion(experimentId, userId, "signup_completed", {
  plan: "professional",
  price: 49,
})
```

### 4. Analyze Results

```typescript
import { getExperimentReport } from "@/lib/experiments"

const report = await getExperimentReport(experimentId)

console.log(report.metrics.variantMetrics)
// [
//   { variantName: "control", conversionRate: 3.2, exposedUsers: 1000 },
//   { variantName: "treatment", conversionRate: 4.8, exposedUsers: 1000 }
// ]

console.log(report.significance)
// {
//   significant: true,
//   pValue: 0.03,
//   confidence: 97%,
//   winner: "treatment",
//   liftPercent: 50%
// }
```

### 5. Complete Experiment

```typescript
import { completeExperiment } from "@/lib/experiments"

await completeExperiment(experimentId, {
  controlValue: 3.2,
  variantValue: 4.8,
})
```

## API Routes

### Admin Endpoints (ADMIN role required)

- `GET /api/experiments` - List all experiments
- `POST /api/experiments` - Create new experiment
- `GET /api/experiments/:id` - Get experiment details
- `PATCH /api/experiments/:id` - Update experiment
- `DELETE /api/experiments/:id` - Delete experiment
- `POST /api/experiments/:id/start` - Start experiment
- `POST /api/experiments/:id/pause` - Pause experiment
- `POST /api/experiments/:id/complete` - Complete experiment
- `GET /api/experiments/:id/metrics` - Get metrics and analysis

### User Endpoints

- `POST /api/experiments/assign` - Assign user to variant

## Statistical Analysis

### Chi-Square Test

Used to determine if difference between variants is statistically significant.

- **Null Hypothesis**: No difference between variants
- **Alternative**: Variants have different conversion rates
- **Significance Level**: α = 0.05 (95% confidence)

### Minimum Sample Size

```typescript
import { calculateRequiredSampleSize } from "@/lib/experiments"

const requiredN = calculateRequiredSampleSize(
  0.03, // baseline conversion rate (3%)
  0.15, // minimum detectable effect (15% relative increase)
  0.8, // power (80%)
  0.05 // alpha (5%)
)
// Returns: ~4,000 users per variant
```

### Statistical Power

- **Power = 80%**: 80% chance of detecting a real effect
- **Alpha = 5%**: 5% chance of false positive
- **MDE = 15%**: Can detect 15% relative change in conversion rate

## PostHog Integration

Experiments automatically track to PostHog:

```javascript
// Enrollment (when user is first assigned)
posthog.capture("experiment_enrolled", {
  experiment: "new-pricing-page",
  variant: "treatment",
})

// Exposure (when user sees the variant)
posthog.capture("experiment_exposure", {
  experiment: "new-pricing-page",
  variant: "treatment",
})

// All subsequent events tagged with experiment context
posthog.capture("signup_completed", {
  $experiment_new_pricing_page: "treatment",
})
```

## Best Practices

### 1. Define Clear Hypothesis

```typescript
{
  hypothesis: "Adding social proof will increase signups by 20%",
  successMetric: "signup_completed"
}
```

### 2. Calculate Sample Size

Don't stop tests too early. Use `calculateRequiredSampleSize()` to determine how many users you need.

### 3. Use Control + Treatment

Always have a control group to measure against.

### 4. Track Meaningful Events

Focus on business metrics, not vanity metrics:

- Conversions: signups, purchases, upgrades
- Engagement: feature usage, retention
- Revenue: LTV, ARPU

### 5. Wait for Statistical Significance

Don't declare a winner until:

- p-value < 0.05
- Minimum sample size reached
- Test run for full business cycle (1-2 weeks)

## Common Patterns

### Feature Flag Experiment

```typescript
const experiment = await createExperiment({
  name: "ai-assistant-rollout",
  variants: [
    { name: "control", weight: 50, config: { aiEnabled: false } },
    { name: "treatment", weight: 50, config: { aiEnabled: true } },
  ],
})

// In component
const { config } = useExperiment("ai-assistant-rollout")
const showAI = config?.aiEnabled === true
```

### Multi-Variant Test

```typescript
const experiment = await createExperiment({
  name: "pricing-tiers",
  variants: [
    { name: "control", weight: 25, config: { tiers: 3 } },
    { name: "variant_a", weight: 25, config: { tiers: 4 } },
    { name: "variant_b", weight: 25, config: { tiers: 5 } },
    { name: "variant_c", weight: 25, config: { tiers: 2 } },
  ],
})
```

### Gradual Rollout

```typescript
// Start with 10% traffic
const experiment = await createExperiment({
  name: "new-feature",
  trafficPercent: 10,
  variants: [
    { name: "control", weight: 50 },
    { name: "treatment", weight: 50 },
  ],
})

// Increase to 50% after observing metrics
await updateExperiment(experiment.id, {
  trafficPercent: 50,
})
```

## Troubleshooting

### Users Not Being Assigned

1. Check experiment status is `RUNNING`
2. Verify `trafficPercent` > 0
3. Check `startDate` hasn't passed
4. Ensure variant weights sum to 100

### Inconsistent Results

1. Verify sticky sessions (check `ExperimentAssignment` table)
2. Check for bot traffic
3. Ensure sufficient sample size
4. Run test for full business cycle

### No Statistical Significance

1. Calculate required sample size
2. Increase test duration
3. Consider larger MDE
4. Check if variants are actually different

## Future Enhancements

- [ ] Multi-armed bandit algorithms
- [ ] Bayesian A/B testing
- [ ] Automatic winner declaration
- [ ] Experiment scheduling
- [ ] Advanced segmentation
- [ ] Real-time metrics dashboard
- [ ] Email notifications for milestones

## References

- [GitHub Issue #292](https://github.com/Wandeon/FiskAI/issues/292)
- [PostHog Experiments](https://posthog.com/docs/experiments)
- [Statistical Significance in A/B Testing](https://www.abtasty.com/blog/statistical-significance/)
- [Chi-Square Test](https://en.wikipedia.org/wiki/Chi-squared_test)
