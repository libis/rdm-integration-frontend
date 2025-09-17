# @ai-tool: Copilot

## Summary

- Add Source column to metadata selector UI and show provenance per field.
- Backend annotates metadata response with source for display only; submission payload unchanged.
- Build, typecheck, and tests PASS locally.

## AI Provenance (required for AI-assisted changes)

- Prompt: Add Source column to metadata selector; add backend provenance hints.
- Model: GitHub Copilot gpt-5
- Date: 2025-09-16T10:00:00Z
- Author: @ErykKul
- Role: deployer

## Compliance checklist

- [x] No secrets/PII
- [ ] Transparency notice updated (if user-facing)
- [x] Agent logging enabled (actions/decisions logged)
- [x] Kill-switch / feature flag present for AI features
- [x] No prohibited practices under EU AI Act
- [x] Human oversight retained (required if high-risk or agent mode)
Risk classification: limited
Personal data: no
DPIA: N/A
Automated decision-making: no
Agent mode used: yes
GPAI obligations: N/A
Vendor GPAI compliance reviewed: N/A
- [x] License/IP attestation
Attribution: N/A

### Change-type specifics

- Security review: N/A
- Media assets changed:
	- [ ] AI content labeled
	- C2PA: N/A
- UI changed:
	- [ ] Accessibility review (EN 301 549/WCAG)
	- Accessibility statement: N/A
- Deploy/infra changed:
	- Privacy notice: N/A
	- Lawful basis: N/A
	- Retention schedule: N/A
	- NIS2 applicability: N/A
	- Incident response plan: N/A
- Backend/API changed:
	- ASVS: N/A
- Log retention policy: N/A
- Data paths changed:
	- TDM: N/A
	- TDM compliance: N/A

## Tests & Risk

- [x] Unit/integration tests added/updated
- [x] Security scan passed
Rollback plan: Revert PR
Smoke test: N/A
- [x] Docs updated (if needed)
