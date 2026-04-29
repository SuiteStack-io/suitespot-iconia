## Change `step="0.01"` → `step="1"` on Rate Guardrails inputs

In `src/pages/DynamicPricing.tsx`, the Min Rate and Max Rate `<Input type="number">` elements in the Rate Guardrails table currently use `step="0.01"`, causing the up/down arrows to adjust by one cent.

### Edits

- **Line 578** (Min Rate input): change `step="0.01"` → `step="1"`
- **Line 598** (Max Rate input): change `step="0.01"` → `step="1"`

No other attributes, validation logic, OTA markup preview, weekend equivalent display, or other inputs will be touched.