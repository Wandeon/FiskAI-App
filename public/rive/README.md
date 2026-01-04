# Rive Animation Files

This directory contains Rive animation files for the FiskAI authentication flow.

## Aurora Background Animation

**File:** `aurora.riv` (pending from designer)

**State Machine:** "State Machine 1"

**Inputs:**

- `state` (Number): Controls the auth state (0-5)
  - 0: identify
  - 1: authenticate
  - 2: register
  - 3: verify
  - 4: success
  - 5: error
- `error` (Trigger): Triggers error animation pulse

**Design Requirements:**

- Smooth gradient aurora effect
- State-reactive color transitions
- Error state should pulse/shake briefly
- Must support reduced motion preferences (CSS fallback)

**Fallback:**
The `AuroraBackground` component includes CSS gradient fallbacks for when:

- Rive file is not loaded
- User prefers reduced motion
- Initial render before Rive loads
