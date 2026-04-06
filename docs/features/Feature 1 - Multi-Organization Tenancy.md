# Feature 1 — Multi-Organization Tenancy

## Entities Introduced

- [[Crew]] — tenant boundary
- [[User]] — authenticated individual (Clerk-managed)
- [[CrewMember]] — join table with role and permissions
- [[Invite]] — invitation to join a Crew

## Summary

Full multi-tenant separation. Users can belong to multiple [[Crew]]s. Each [[Crew]] is fully isolated — its own [[Space]]s, [[InventoryItem]]s, [[Recipe]]s, [[ShoppingList]]s. Permissions use role-based defaults (Admin, Member, Viewer) with per-feature overrides on [[CrewMember]].

## Key Decisions

- Multi-membership: a single [[User]] can belong to multiple [[Crew]]s (e.g., manage home AND help run the bar at Haywire)
- Roles + overrides: Admin/Member/Viewer as defaults, with granular per-feature permission overrides
- Full isolation: each [[Crew]] has completely separate data
- Invite system: Admins create [[Invite]]s with unique codes, sent via email, accepted by signing up or signing in

## Downstream Impact

Every other feature depends on this. The `crew_id` foreign key appears on [[Space]], [[InventoryItem]], [[Flow]], [[WasteEvent]] (via Flow), [[BatchEvent]], [[ShoppingList]], [[Recipe]], [[Category]], [[Product]] (for custom products), and [[KioskSession]].

## See Also

- [[Journey - Onboarding]] — covers all three onboarding paths including invite acceptance
