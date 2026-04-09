# Edge Review — User Journeys v2

Use this document to verify each edge makes conceptual sense, and to annotate with data flow and UI transition details for implementation.

---

## Onboarding

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Onboarding.md | Entry Point 1 |  |
| 2 | journeys/Onboarding.md | Entry Point 2 |  |
| 3 | journeys/Onboarding.md | Entry Point 3 |  |
| 4 | Entry Point 1 | Step 1 — Landing Page |  |
| 5 | Entry Point 2 | Step 1 — Validate Invite |  |
| 6 | Entry Point 3 | Step 1 — Navigate |  |
| 7 | Step 1 — Landing Page | Step 2 — Sign Up via Clerk |  |
| 8 | Step 2 — Sign Up via Clerk | Step 3 — Crew Decision |  |
| 9 | Step 3 — Crew Decision | Step 4 — Create Your Crew | Start fresh |
| 10 | Step 4 — Create Your Crew | Step 5 — Set Up Spaces |  |
| 11 | Step 5 — Set Up Spaces | Step 6 — Add First Items |  |
| 12 | Step 6 — Add First Items | Step 7 — Invite Your Crew |  |
| 13 | Step 7 — Invite Your Crew | Step 8 — Wizard Complete |  |
| 14 | Step 3 — Crew Decision | Step 3 — Accept Invite + Set PIN | Has invite |
| 15 | Step 1 — Validate Invite | Step 2 — Sign In or Sign Up |  |
| 16 | Step 2 — Sign In or Sign Up | Step 3 — Accept Invite + Set PIN |  |
| 17 | Step 3 — Accept Invite + Set PIN | Step 4 — Dashboard |  |
| 18 | Step 1 — Navigate | Step 2 — Admin Authenticates |  |
| 19 | Step 2 — Admin Authenticates | Step 3 — Kiosk Configuration |  |
| 20 | Step 3 — Kiosk Configuration | Step 4 — Confirm and Enroll |  |
| 21 | Step 4 — Confirm and Enroll | Step 5 — Kiosk Mode Activates |  |

#### 1. journeys/Onboarding.md → Entry Point 1

**Data Flow:**

**UI Detail:**

#### 2. journeys/Onboarding.md → Entry Point 2

**Data Flow:**

**UI Detail:**

#### 3. journeys/Onboarding.md → Entry Point 3

**Data Flow:**

**UI Detail:**

#### 4. Entry Point 1 → Step 1 — Landing Page

**Data Flow:**

**UI Detail:**

#### 5. Entry Point 2 → Step 1 — Validate Invite

**Data Flow:**

**UI Detail:**

#### 6. Entry Point 3 → Step 1 — Navigate

**Data Flow:**

**UI Detail:**

#### 7. Step 1 — Landing Page → Step 2 — Sign Up via Clerk

**Data Flow:**

**UI Detail:**

#### 8. Step 2 — Sign Up via Clerk → Step 3 — Crew Decision

**Data Flow:**

**UI Detail:**

#### 9. Step 3 — Crew Decision → Step 4 — Create Your Crew (Start fresh)

**Data Flow:**

**UI Detail:**

#### 10. Step 4 — Create Your Crew → Step 5 — Set Up Spaces

**Data Flow:**

**UI Detail:**

#### 11. Step 5 — Set Up Spaces → Step 6 — Add First Items

**Data Flow:**

**UI Detail:**

#### 12. Step 6 — Add First Items → Step 7 — Invite Your Crew

**Data Flow:**

**UI Detail:**

#### 13. Step 7 — Invite Your Crew → Step 8 — Wizard Complete

**Data Flow:**

**UI Detail:**

#### 14. Step 3 — Crew Decision → Step 3 — Accept Invite + Set PIN (Has invite)

**Data Flow:**

**UI Detail:**

#### 15. Step 1 — Validate Invite → Step 2 — Sign In or Sign Up

**Data Flow:**

**UI Detail:**

#### 16. Step 2 — Sign In or Sign Up → Step 3 — Accept Invite + Set PIN

**Data Flow:**

**UI Detail:**

#### 17. Step 3 — Accept Invite + Set PIN → Step 4 — Dashboard

**Data Flow:**

**UI Detail:**

#### 18. Step 1 — Navigate → Step 2 — Admin Authenticates

**Data Flow:**

**UI Detail:**

#### 19. Step 2 — Admin Authenticates → Step 3 — Kiosk Configuration

**Data Flow:**

**UI Detail:**

#### 20. Step 3 — Kiosk Configuration → Step 4 — Confirm and Enroll

**Data Flow:**

**UI Detail:**

#### 21. Step 4 — Confirm and Enroll → Step 5 — Kiosk Mode Activates

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 2 — Sign Up via Clerk | entities/User.md |  |
| 2 | Step 4 — Create Your Crew | entities/Crew.md |  |
| 3 | Step 4 — Create Your Crew | entities/CrewMember.md |  |
| 4 | Step 3 — Accept Invite + Set PIN | entities/Invite.md |  |
| 5 | Step 7 — Invite Your Crew | entities/Invite.md |  |
| 6 | Step 4 — Confirm and Enroll | entities/KioskSession.md |  |
| 7 | Step 5 — Set Up Spaces | entities/Space.md |  |
| 8 | Step 2 — Sign In or Sign Up | entities/User.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Landing Page] | Step 1 — Landing Page |
| 2 | [MOCK: Sign Up] | Step 2 — Sign Up via Clerk |
| 3 | [MOCK: Crew Decision] | Step 3 — Crew Decision |
| 4 | [MOCK: Create Crew] | Step 4 — Create Your Crew |
| 5 | [MOCK: Dashboard + Checklist] | Step 8 — Wizard Complete |
| 6 | [MOCK: Kiosk Configuration] | Step 3 — Kiosk Configuration |

---

## Space Setup

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Space Setup.md | Phase 1 — The Explainer |  |
| 2 | Phase 1 — The Explainer | Phase 2 — Create Your Premises |  |
| 3 | Phase 2 — Create Your Premises | Step 3a — Add an Area |  |
| 4 | Step 3a — Add an Area | Step 3b — Add a Zone |  |
| 5 | Step 3b — Add a Zone | Step 3c — Add a Section |  |
| 6 | Step 3c — Add a Section | Step 3d — Add a Sub-Section |  |
| 7 | Step 3d — Add a Sub-Section | Step 3e — Add a Container |  |
| 8 | Step 3e — Add a Container | Step 3f — Add a Shelf |  |
| 9 | Step 3f — Add a Shelf | After the First Branch |  |
| 10 | After the First Branch | Phase 4 — Tree Editor |  |
| 11 | Phase 4 — Tree Editor | Phase 5 — Template Option | Use a template |

#### 1. journeys/Space Setup.md → Phase 1 — The Explainer

**Data Flow:**

**UI Detail:**

#### 2. Phase 1 — The Explainer → Phase 2 — Create Your Premises

**Data Flow:**

**UI Detail:**

#### 3. Phase 2 — Create Your Premises → Step 3a — Add an Area

**Data Flow:**

**UI Detail:**

#### 4. Step 3a — Add an Area → Step 3b — Add a Zone

**Data Flow:**

**UI Detail:**

#### 5. Step 3b — Add a Zone → Step 3c — Add a Section

**Data Flow:**

**UI Detail:**

#### 6. Step 3c — Add a Section → Step 3d — Add a Sub-Section

**Data Flow:**

**UI Detail:**

#### 7. Step 3d — Add a Sub-Section → Step 3e — Add a Container

**Data Flow:**

**UI Detail:**

#### 8. Step 3e — Add a Container → Step 3f — Add a Shelf

**Data Flow:**

**UI Detail:**

#### 9. Step 3f — Add a Shelf → After the First Branch

**Data Flow:**

**UI Detail:**

#### 10. After the First Branch → Phase 4 — Tree Editor

**Data Flow:**

**UI Detail:**

#### 11. Phase 4 — Tree Editor → Phase 5 — Template Option (Use a template)

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 3a — Add an Area | entities/Space.md |  |
| 2 | Phase 2 — Create Your Premises | entities/Space.md |  |
| 3 | Phase 5 — Template Option | entities/SpaceTemplate.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Explainer Screen] | Phase 1 — The Explainer |
| 2 | [MOCK: Premises Input] | Phase 2 — Create Your Premises |
| 3 | [MOCK: Guided Branch Prompt] | Step 3a — Add an Area |
| 4 | [MOCK: Tree Editor] | Phase 4 — Tree Editor |

---

## Crew Management

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Crew Management.md | Crew Switcher |  |
| 2 | Crew Switcher | Crew List Page |  |
| 3 | Crew List Page | Crew Settings Hub |  |
| 4 | Crew List Page | Action 6 — Leave Crew | Leave |
| 5 | Crew Settings Hub | Action 1 — Invite Members | Members |
| 6 | Crew Settings Hub | Action 2 — Change Role | Members |
| 7 | Crew Settings Hub | Action 3 — Permission Overrides | Permissions |
| 8 | Crew Settings Hub | Action 4 — Remove Member | Members |
| 9 | Crew Settings Hub | Action 7 — Edit Settings | General |
| 10 | Crew Settings Hub | Action 5 — Transfer Ownership | Danger Zone |
| 11 | Crew Settings Hub | Action 8 — Delete Crew | Danger Zone |

#### 1. journeys/Crew Management.md → Crew Switcher

**Data Flow:**

**UI Detail:**

#### 2. Crew Switcher → Crew List Page

**Data Flow:**

**UI Detail:**

#### 3. Crew List Page → Crew Settings Hub

**Data Flow:**

**UI Detail:**

#### 4. Crew List Page → Action 6 — Leave Crew (Leave)

**Data Flow:**

**UI Detail:**

#### 5. Crew Settings Hub → Action 1 — Invite Members (Members)

**Data Flow:**

**UI Detail:**

#### 6. Crew Settings Hub → Action 2 — Change Role (Members)

**Data Flow:**

**UI Detail:**

#### 7. Crew Settings Hub → Action 3 — Permission Overrides (Permissions)

**Data Flow:**

**UI Detail:**

#### 8. Crew Settings Hub → Action 4 — Remove Member (Members)

**Data Flow:**

**UI Detail:**

#### 9. Crew Settings Hub → Action 7 — Edit Settings (General)

**Data Flow:**

**UI Detail:**

#### 10. Crew Settings Hub → Action 5 — Transfer Ownership (Danger Zone)

**Data Flow:**

**UI Detail:**

#### 11. Crew Settings Hub → Action 8 — Delete Crew (Danger Zone)

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Action 1 — Invite Members | entities/Invite.md |  |
| 2 | Action 2 — Change Role | entities/CrewMember.md |  |
| 3 | Action 3 — Permission Overrides | entities/CrewMember.md |  |
| 4 | Action 4 — Remove Member | entities/CrewMember.md |  |
| 5 | Action 5 — Transfer Ownership | entities/Crew.md |  |
| 6 | Action 7 — Edit Settings | entities/Crew.md |  |
| 7 | Action 8 — Delete Crew | entities/Crew.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Crew List Page] | Crew List Page |
| 2 | [MOCK: Members Tab] | Action 1 — Invite Members |
| 3 | [MOCK: Delete Confirmation] | Action 8 — Delete Crew |

---

## Adding Inventory

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Adding Inventory.md | Entry: Inventory Page |  |
| 2 | journeys/Adding Inventory.md | Entry: Space Page |  |
| 3 | journeys/Adding Inventory.md | Entry: Global Quick-Add |  |
| 4 | Entry: Inventory Page | Method Hub |  |
| 5 | Entry: Space Page | Method Hub |  |
| 6 | Entry: Global Quick-Add | Method Hub |  |
| 7 | Method Hub | Step 1 — Product Resolution | Manual |
| 8 | Method Hub | Step 1 — Upload | Bulk Import |
| 9 | Method Hub | Step 1 — Barcode Scan | Barcode |
| 10 | Method Hub | Method 4 — Quick Add | Quick Add |
| 11 | Step 1 — Product Resolution | Group A — Catalog Match |  |
| 12 | Step 1 — Product Resolution | Group B — Existing Inventory |  |
| 13 | Step 1 — Product Resolution | Group C — Create Custom |  |
| 14 | Group A — Catalog Match | Step 2 — Inventory Details |  |
| 15 | Group B — Existing Inventory | Restock Sub-Flow | Restock |
| 16 | Group B — Existing Inventory | Step 2 — Inventory Details | Add another |
| 17 | Group C — Create Custom | Step 2 — Inventory Details |  |
| 18 | Step 2 — Inventory Details | Stay in Flow |  |
| 19 | Stay in Flow | Step 1 — Product Resolution | Next item |
| 20 | Restock Sub-Flow | Step 1 — Product Resolution | Next item |
| 21 | Step 1 — Upload | Step 2 — Column Mapping |  |
| 22 | Step 2 — Column Mapping | Step 3 — Preview & Resolve |  |
| 23 | Step 3 — Preview & Resolve | Step 4 — Import |  |
| 24 | Step 1 — Barcode Scan | Step 2 — Inventory Details | Found/Created |
| 25 | Step 1 — Barcode Scan | Restock Sub-Flow | In inventory |
| 26 | Method 4 — Quick Add | Step 2 — Inventory Details |  |

#### 1. journeys/Adding Inventory.md → Entry: Inventory Page

**Data Flow:**

**UI Detail:**

#### 2. journeys/Adding Inventory.md → Entry: Space Page

**Data Flow:**

**UI Detail:**

#### 3. journeys/Adding Inventory.md → Entry: Global Quick-Add

**Data Flow:**

**UI Detail:**

#### 4. Entry: Inventory Page → Method Hub

**Data Flow:**

**UI Detail:**

#### 5. Entry: Space Page → Method Hub

**Data Flow:**

**UI Detail:**

#### 6. Entry: Global Quick-Add → Method Hub

**Data Flow:**

**UI Detail:**

#### 7. Method Hub → Step 1 — Product Resolution (Manual)

**Data Flow:**

**UI Detail:**

#### 8. Method Hub → Step 1 — Upload (Bulk Import)

**Data Flow:**

**UI Detail:**

#### 9. Method Hub → Step 1 — Barcode Scan (Barcode)

**Data Flow:**

**UI Detail:**

#### 10. Method Hub → Method 4 — Quick Add (Quick Add)

**Data Flow:**

**UI Detail:**

#### 11. Step 1 — Product Resolution → Group A — Catalog Match

**Data Flow:**

**UI Detail:**

#### 12. Step 1 — Product Resolution → Group B — Existing Inventory

**Data Flow:**

**UI Detail:**

#### 13. Step 1 — Product Resolution → Group C — Create Custom

**Data Flow:**

**UI Detail:**

#### 14. Group A — Catalog Match → Step 2 — Inventory Details

**Data Flow:**

**UI Detail:**

#### 15. Group B — Existing Inventory → Restock Sub-Flow (Restock)

**Data Flow:**

**UI Detail:**

#### 16. Group B — Existing Inventory → Step 2 — Inventory Details (Add another)

**Data Flow:**

**UI Detail:**

#### 17. Group C — Create Custom → Step 2 — Inventory Details

**Data Flow:**

**UI Detail:**

#### 18. Step 2 — Inventory Details → Stay in Flow

**Data Flow:**

**UI Detail:**

#### 19. Stay in Flow → Step 1 — Product Resolution (Next item)

**Data Flow:**

**UI Detail:**

#### 20. Restock Sub-Flow → Step 1 — Product Resolution (Next item)

**Data Flow:**

**UI Detail:**

#### 21. Step 1 — Upload → Step 2 — Column Mapping

**Data Flow:**

**UI Detail:**

#### 22. Step 2 — Column Mapping → Step 3 — Preview & Resolve

**Data Flow:**

**UI Detail:**

#### 23. Step 3 — Preview & Resolve → Step 4 — Import

**Data Flow:**

**UI Detail:**

#### 24. Step 1 — Barcode Scan → Step 2 — Inventory Details (Found/Created)

**Data Flow:**

**UI Detail:**

#### 25. Step 1 — Barcode Scan → Restock Sub-Flow (In inventory)

**Data Flow:**

**UI Detail:**

#### 26. Method 4 — Quick Add → Step 2 — Inventory Details

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 1 — Product Resolution | entities/Product.md |  |
| 2 | Step 2 — Inventory Details | entities/InventoryItem.md |  |
| 3 | Step 2 — Inventory Details | entities/Flow.md |  |
| 4 | Step 2 — Inventory Details | entities/Category.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Product Search] | Step 1 — Product Resolution |
| 2 | [MOCK: Inventory Details Form] | Step 2 — Inventory Details |
| 3 | [MOCK: Bulk Import Preview] | Step 3 — Preview & Resolve |
| 4 | [MOCK: Barcode Scanner] | Step 1 — Barcode Scan |

---

## Checking Stock

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Checking Stock.md | Entry: Inventory Page |  |
| 2 | journeys/Checking Stock.md | Entry: Spaces Page |  |
| 3 | journeys/Checking Stock.md | Entry: Alerts Summary |  |
| 4 | journeys/Checking Stock.md | Entry: Global Search |  |
| 5 | Entry: Inventory Page | Inventory List |  |
| 6 | Entry: Spaces Page | Inventory List |  |
| 7 | Entry: Alerts Summary | Alerts Summary |  |
| 8 | Entry: Global Search | Inventory List |  |
| 9 | Inventory List | Search & Filters |  |
| 10 | Inventory List | Inline Expansion |  |
| 11 | Inline Expansion | Inline Actions |  |
| 12 | Inventory List | Browse by Category |  |
| 13 | Alerts Summary | Inventory List |  |

#### 1. journeys/Checking Stock.md → Entry: Inventory Page

**Data Flow:**

**UI Detail:**

#### 2. journeys/Checking Stock.md → Entry: Spaces Page

**Data Flow:**

**UI Detail:**

#### 3. journeys/Checking Stock.md → Entry: Alerts Summary

**Data Flow:**

**UI Detail:**

#### 4. journeys/Checking Stock.md → Entry: Global Search

**Data Flow:**

**UI Detail:**

#### 5. Entry: Inventory Page → Inventory List

**Data Flow:**

**UI Detail:**

#### 6. Entry: Spaces Page → Inventory List

**Data Flow:**

**UI Detail:**

#### 7. Entry: Alerts Summary → Alerts Summary

**Data Flow:**

**UI Detail:**

#### 8. Entry: Global Search → Inventory List

**Data Flow:**

**UI Detail:**

#### 9. Inventory List → Search & Filters

**Data Flow:**

**UI Detail:**

#### 10. Inventory List → Inline Expansion

**Data Flow:**

**UI Detail:**

#### 11. Inline Expansion → Inline Actions

**Data Flow:**

**UI Detail:**

#### 12. Inventory List → Browse by Category

**Data Flow:**

**UI Detail:**

#### 13. Alerts Summary → Inventory List

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Inline Expansion | entities/InventoryItem.md |  |
| 2 | Inline Expansion | entities/Product.md |  |
| 3 | Inline Expansion | entities/Flow.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Inventory List] | Inventory List |
| 2 | [MOCK: Item Detail Expansion] | Inline Expansion |
| 3 | [MOCK: Alerts Summary] | Alerts Summary |

---

## Moving Items

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Moving Items.md | Entry: Checking Stock |  |
| 2 | journeys/Moving Items.md | Entry: Spaces Page |  |
| 3 | journeys/Moving Items.md | Entry: Dashboard Alerts |  |
| 4 | Entry: Checking Stock | Scenario Hub |  |
| 5 | Entry: Spaces Page | Scenario Hub |  |
| 6 | Entry: Dashboard Alerts | Scenario Hub |  |
| 7 | Scenario Hub | Scenario 1 — Single Item Move | Single |
| 8 | Scenario Hub | Scenario 2 — Put-Back Routine | Put-back |
| 9 | Scenario Hub | Scenario 3 — Set Home Locations | Set home |
| 10 | Scenario Hub | Scenario 4 — Bulk Reassign | Bulk |
| 11 | Scenario Hub | Scenario 5 — Reorganize | Reorganize |
| 12 | Scenario 2 — Put-Back Routine | Preview & Confirm |  |
| 13 | Scenario 4 — Bulk Reassign | Preview & Confirm |  |
| 14 | Scenario 5 — Reorganize | Preview & Confirm |  |

#### 1. journeys/Moving Items.md → Entry: Checking Stock

**Data Flow:**

**UI Detail:**

#### 2. journeys/Moving Items.md → Entry: Spaces Page

**Data Flow:**

**UI Detail:**

#### 3. journeys/Moving Items.md → Entry: Dashboard Alerts

**Data Flow:**

**UI Detail:**

#### 4. Entry: Checking Stock → Scenario Hub

**Data Flow:**

**UI Detail:**

#### 5. Entry: Spaces Page → Scenario Hub

**Data Flow:**

**UI Detail:**

#### 6. Entry: Dashboard Alerts → Scenario Hub

**Data Flow:**

**UI Detail:**

#### 7. Scenario Hub → Scenario 1 — Single Item Move (Single)

**Data Flow:**

**UI Detail:**

#### 8. Scenario Hub → Scenario 2 — Put-Back Routine (Put-back)

**Data Flow:**

**UI Detail:**

#### 9. Scenario Hub → Scenario 3 — Set Home Locations (Set home)

**Data Flow:**

**UI Detail:**

#### 10. Scenario Hub → Scenario 4 — Bulk Reassign (Bulk)

**Data Flow:**

**UI Detail:**

#### 11. Scenario Hub → Scenario 5 — Reorganize (Reorganize)

**Data Flow:**

**UI Detail:**

#### 12. Scenario 2 — Put-Back Routine → Preview & Confirm

**Data Flow:**

**UI Detail:**

#### 13. Scenario 4 — Bulk Reassign → Preview & Confirm

**Data Flow:**

**UI Detail:**

#### 14. Scenario 5 — Reorganize → Preview & Confirm

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Preview & Confirm | entities/InventoryItem.md |  |
| 2 | Preview & Confirm | entities/Flow.md |  |
| 3 | Preview & Confirm | entities/Space.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Put-Back Checklist] | Scenario 2 — Put-Back Routine |
| 2 | [MOCK: Bulk Reassign Preview] | Preview & Confirm |
| 3 | [MOCK: Reorganize View] | Scenario 5 — Reorganize |

---

## Intake Session

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Intake Session.md | Entry: Completed Shopping List |  |
| 2 | journeys/Intake Session.md | Entry: Manual Start |  |
| 3 | Entry: Completed Shopping List | Step 1 — Create Session |  |
| 4 | Entry: Manual Start | Step 1 — Create Session |  |
| 5 | Step 1 — Create Session | Batch Table | Batch table |
| 6 | Step 1 — Create Session | Sequential Processing | Sequential |
| 7 | Batch Table | Discrepancy Handling |  |
| 8 | Discrepancy Handling | Add Unlisted Items |  |
| 9 | Sequential Processing | Shelving Options |  |
| 10 | Add Unlisted Items | Review & Complete |  |
| 11 | Shelving Options | Review & Complete |  |

#### 1. journeys/Intake Session.md → Entry: Completed Shopping List

**Data Flow:**

**UI Detail:**

#### 2. journeys/Intake Session.md → Entry: Manual Start

**Data Flow:**

**UI Detail:**

#### 3. Entry: Completed Shopping List → Step 1 — Create Session

**Data Flow:**

**UI Detail:**

#### 4. Entry: Manual Start → Step 1 — Create Session

**Data Flow:**

**UI Detail:**

#### 5. Step 1 — Create Session → Batch Table (Batch table)

**Data Flow:**

**UI Detail:**

#### 6. Step 1 — Create Session → Sequential Processing (Sequential)

**Data Flow:**

**UI Detail:**

#### 7. Batch Table → Discrepancy Handling

**Data Flow:**

**UI Detail:**

#### 8. Discrepancy Handling → Add Unlisted Items

**Data Flow:**

**UI Detail:**

#### 9. Sequential Processing → Shelving Options

**Data Flow:**

**UI Detail:**

#### 10. Add Unlisted Items → Review & Complete

**Data Flow:**

**UI Detail:**

#### 11. Shelving Options → Review & Complete

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 1 — Create Session | entities/IntakeSession.md |  |
| 2 | Step 1 — Create Session | entities/IntakeSessionItem.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Session Start] | Step 1 — Create Session |
| 2 | [MOCK: Batch Table] | Batch Table |
| 3 | [MOCK: Completion Summary] | Review & Complete |

---

## Creating a Recipe

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Creating a Recipe.md | Entry: Recipes Page |  |
| 2 | journeys/Creating a Recipe.md | Entry: After Batching |  |
| 3 | journeys/Creating a Recipe.md | Entry: Duplicate |  |
| 4 | Entry: Recipes Page | Section 1 — Recipe Info |  |
| 5 | Entry: After Batching | Section 1 — Recipe Info |  |
| 6 | Entry: Duplicate | Section 1 — Recipe Info |  |
| 7 | Section 1 — Recipe Info | Ingredient Search |  |
| 8 | Section 1 — Recipe Info | Section 3 — Steps |  |
| 9 | Ingredient Search | Per-Ingredient Fields |  |
| 10 | Per-Ingredient Fields | Live Cost Estimate |  |
| 11 | Per-Ingredient Fields | Unlinked Ingredients | If unlinked |
| 12 | Section 3 — Steps | Save |  |
| 13 | Live Cost Estimate | Save |  |
| 14 | Save | After Creation |  |

#### 1. journeys/Creating a Recipe.md → Entry: Recipes Page

**Data Flow:**

**UI Detail:**

#### 2. journeys/Creating a Recipe.md → Entry: After Batching

**Data Flow:**

**UI Detail:**

#### 3. journeys/Creating a Recipe.md → Entry: Duplicate

**Data Flow:**

**UI Detail:**

#### 4. Entry: Recipes Page → Section 1 — Recipe Info

**Data Flow:**

**UI Detail:**

#### 5. Entry: After Batching → Section 1 — Recipe Info

**Data Flow:**

**UI Detail:**

#### 6. Entry: Duplicate → Section 1 — Recipe Info

**Data Flow:**

**UI Detail:**

#### 7. Section 1 — Recipe Info → Ingredient Search

**Data Flow:**

**UI Detail:**

#### 8. Section 1 — Recipe Info → Section 3 — Steps

**Data Flow:**

**UI Detail:**

#### 9. Ingredient Search → Per-Ingredient Fields

**Data Flow:**

**UI Detail:**

#### 10. Per-Ingredient Fields → Live Cost Estimate

**Data Flow:**

**UI Detail:**

#### 11. Per-Ingredient Fields → Unlinked Ingredients (If unlinked)

**Data Flow:**

**UI Detail:**

#### 12. Section 3 — Steps → Save

**Data Flow:**

**UI Detail:**

#### 13. Live Cost Estimate → Save

**Data Flow:**

**UI Detail:**

#### 14. Save → After Creation

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Ingredient Search | entities/ProductGroup.md |  |
| 2 | Save | entities/Recipe.md |  |
| 3 | Save | entities/RecipeVersion.md |  |
| 4 | Save | entities/RecipeIngredient.md |  |
| 5 | Save | entities/RecipeStep.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Recipe Form] | Section 1 — Recipe Info |
| 2 | [MOCK: Ingredient Search] | Ingredient Search |
| 3 | [MOCK: Recipe View] | After Creation |

---

## Editing a Recipe

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Editing a Recipe.md | Entry: Recipe View |  |
| 2 | journeys/Editing a Recipe.md | Entry: After a Batch |  |
| 3 | journeys/Editing a Recipe.md | Entry: Version History |  |
| 4 | Entry: Recipe View | Edit Form |  |
| 5 | Entry: After a Batch | Edit Form |  |
| 6 | Entry: Version History | Edit Form |  |
| 7 | Edit Form | Metadata Edits | Metadata only |
| 8 | Edit Form | Substance Edits | Substance changed |
| 9 | Substance Edits | Save (New Version) |  |
| 10 | Save (New Version) | Version List |  |
| 11 | Version List | Compare Versions |  |
| 12 | Compare Versions | Revert |  |
| 13 | Revert | Edit Form | Revert |

#### 1. journeys/Editing a Recipe.md → Entry: Recipe View

**Data Flow:**

**UI Detail:**

#### 2. journeys/Editing a Recipe.md → Entry: After a Batch

**Data Flow:**

**UI Detail:**

#### 3. journeys/Editing a Recipe.md → Entry: Version History

**Data Flow:**

**UI Detail:**

#### 4. Entry: Recipe View → Edit Form

**Data Flow:**

**UI Detail:**

#### 5. Entry: After a Batch → Edit Form

**Data Flow:**

**UI Detail:**

#### 6. Entry: Version History → Edit Form

**Data Flow:**

**UI Detail:**

#### 7. Edit Form → Metadata Edits (Metadata only)

**Data Flow:**

**UI Detail:**

#### 8. Edit Form → Substance Edits (Substance changed)

**Data Flow:**

**UI Detail:**

#### 9. Substance Edits → Save (New Version)

**Data Flow:**

**UI Detail:**

#### 10. Save (New Version) → Version List

**Data Flow:**

**UI Detail:**

#### 11. Version List → Compare Versions

**Data Flow:**

**UI Detail:**

#### 12. Compare Versions → Revert

**Data Flow:**

**UI Detail:**

#### 13. Revert → Edit Form (Revert)

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Save (New Version) | entities/Recipe.md |  |
| 2 | Revert | entities/RecipeVersion.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Edit Form] | Edit Form |
| 2 | [MOCK: Version Comparison] | Compare Versions |
| 3 | [MOCK: Save with Versioning] | Save (New Version) |

---

## Cooking a Meal

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Cooking a Meal.md | Entry: Recipe View |  |
| 2 | journeys/Cooking a Meal.md | Entry: Recipes List |  |
| 3 | journeys/Cooking a Meal.md | Entry: Kiosk / Dashboard |  |
| 4 | Entry: Recipe View | Step 1 — Select & Scale |  |
| 5 | Entry: Recipes List | Step 1 — Select & Scale |  |
| 6 | Entry: Kiosk / Dashboard | Step 1 — Select & Scale |  |
| 7 | Step 1 — Select & Scale | Step 2 — Review & Resolve |  |
| 8 | Step 2 — Review & Resolve | Step 3 — Cook (Deduct As You Go) |  |
| 9 | Step 3 — Cook (Deduct As You Go) | Step 4 — Complete |  |
| 10 | Step 3 — Cook (Deduct As You Go) | Mid-Batch Failure | Failure |
| 11 | Mid-Batch Failure | Waste Path | Log as waste |

#### 1. journeys/Cooking a Meal.md → Entry: Recipe View

**Data Flow:**

**UI Detail:**

#### 2. journeys/Cooking a Meal.md → Entry: Recipes List

**Data Flow:**

**UI Detail:**

#### 3. journeys/Cooking a Meal.md → Entry: Kiosk / Dashboard

**Data Flow:**

**UI Detail:**

#### 4. Entry: Recipe View → Step 1 — Select & Scale

**Data Flow:**

**UI Detail:**

#### 5. Entry: Recipes List → Step 1 — Select & Scale

**Data Flow:**

**UI Detail:**

#### 6. Entry: Kiosk / Dashboard → Step 1 — Select & Scale

**Data Flow:**

**UI Detail:**

#### 7. Step 1 — Select & Scale → Step 2 — Review & Resolve

**Data Flow:**

**UI Detail:**

#### 8. Step 2 — Review & Resolve → Step 3 — Cook (Deduct As You Go)

**Data Flow:**

**UI Detail:**

#### 9. Step 3 — Cook (Deduct As You Go) → Step 4 — Complete

**Data Flow:**

**UI Detail:**

#### 10. Step 3 — Cook (Deduct As You Go) → Mid-Batch Failure (Failure)

**Data Flow:**

**UI Detail:**

#### 11. Mid-Batch Failure → Waste Path (Log as waste)

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 4 — Complete | entities/BatchEvent.md |  |
| 2 | Step 3 — Cook (Deduct As You Go) | entities/BatchInput.md |  |
| 3 | Step 3 — Cook (Deduct As You Go) | entities/Flow.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Ingredient Resolution] | Step 2 — Review & Resolve |
| 2 | [MOCK: Cooking Mode] | Step 3 — Cook (Deduct As You Go) |
| 3 | [MOCK: Completion Summary] | Step 4 — Complete |

---

## Prepping for Storage

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Prepping for Storage.md | Entry: Recipe View |  |
| 2 | journeys/Prepping for Storage.md | Entry: Recipes List |  |
| 3 | Entry: Recipe View | Steps 1–3 — Shared with Cooking a Meal |  |
| 4 | Entry: Recipes List | Steps 1–3 — Shared with Cooking a Meal |  |
| 5 | Steps 1–3 — Shared with Cooking a Meal | Output Product |  |
| 6 | Output Product | Single or Split? |  |
| 7 | Single or Split? | Single Output Form | Single |
| 8 | Single or Split? | Split Output Form | Split |
| 9 | Single Output Form | Step 5 — Complete |  |
| 10 | Split Output Form | Step 5 — Complete |  |

#### 1. journeys/Prepping for Storage.md → Entry: Recipe View

**Data Flow:**

**UI Detail:**

#### 2. journeys/Prepping for Storage.md → Entry: Recipes List

**Data Flow:**

**UI Detail:**

#### 3. Entry: Recipe View → Steps 1–3 — Shared with Cooking a Meal

**Data Flow:**

**UI Detail:**

#### 4. Entry: Recipes List → Steps 1–3 — Shared with Cooking a Meal

**Data Flow:**

**UI Detail:**

#### 5. Steps 1–3 — Shared with Cooking a Meal → Output Product

**Data Flow:**

**UI Detail:**

#### 6. Output Product → Single or Split?

**Data Flow:**

**UI Detail:**

#### 7. Single or Split? → Single Output Form (Single)

**Data Flow:**

**UI Detail:**

#### 8. Single or Split? → Split Output Form (Split)

**Data Flow:**

**UI Detail:**

#### 9. Single Output Form → Step 5 — Complete

**Data Flow:**

**UI Detail:**

#### 10. Split Output Form → Step 5 — Complete

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Step 5 — Complete | entities/BatchEvent.md |  |
| 2 | Step 5 — Complete | entities/BatchOutput.md |  |
| 3 | Step 5 — Complete | entities/InventoryItem.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Output Definition] | Single or Split? |
| 2 | [MOCK: Completion Summary] | Step 5 — Complete |

---

## Building a Shopping List

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Building a Shopping List.md | Entry: Shopping Page |  |
| 2 | journeys/Building a Shopping List.md | Entry: Checking Stock |  |
| 3 | journeys/Building a Shopping List.md | Entry: Expiry/Quick-Add |  |
| 4 | Entry: Shopping Page | Create New List |  |
| 5 | Entry: Checking Stock | Add Items |  |
| 6 | Entry: Expiry/Quick-Add | Add Items |  |
| 7 | Create New List | Add Items |  |
| 8 | Add Items | List View |  |
| 9 | List View | List Lifecycle |  |

#### 1. journeys/Building a Shopping List.md → Entry: Shopping Page

**Data Flow:**

**UI Detail:**

#### 2. journeys/Building a Shopping List.md → Entry: Checking Stock

**Data Flow:**

**UI Detail:**

#### 3. journeys/Building a Shopping List.md → Entry: Expiry/Quick-Add

**Data Flow:**

**UI Detail:**

#### 4. Entry: Shopping Page → Create New List

**Data Flow:**

**UI Detail:**

#### 5. Entry: Checking Stock → Add Items

**Data Flow:**

**UI Detail:**

#### 6. Entry: Expiry/Quick-Add → Add Items

**Data Flow:**

**UI Detail:**

#### 7. Create New List → Add Items

**Data Flow:**

**UI Detail:**

#### 8. Add Items → List View

**Data Flow:**

**UI Detail:**

#### 9. List View → List Lifecycle

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Add Items | entities/ShoppingList.md |  |
| 2 | Add Items | entities/ShoppingListItem.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Shopping List View] | List View |
| 2 | [MOCK: Add Item Search] | Add Items |

---

## Auto-Generated Shopping List

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Auto-Generated Shopping List.md | Suggested Items List |  |
| 2 | Suggested Items List | Trigger 1 — Low Stock |  |
| 3 | Suggested Items List | Trigger 2 — Recipe Needs |  |
| 4 | Suggested Items List | Trigger 3 — Planned Batch |  |
| 5 | Suggested Items List | Configuration |  |
| 6 | Trigger 1 — Low Stock | Move to Real Lists |  |
| 7 | Trigger 2 — Recipe Needs | Move to Real Lists |  |
| 8 | Trigger 3 — Planned Batch | Move to Real Lists |  |

#### 1. journeys/Auto-Generated Shopping List.md → Suggested Items List

**Data Flow:**

**UI Detail:**

#### 2. Suggested Items List → Trigger 1 — Low Stock

**Data Flow:**

**UI Detail:**

#### 3. Suggested Items List → Trigger 2 — Recipe Needs

**Data Flow:**

**UI Detail:**

#### 4. Suggested Items List → Trigger 3 — Planned Batch

**Data Flow:**

**UI Detail:**

#### 5. Suggested Items List → Configuration

**Data Flow:**

**UI Detail:**

#### 6. Trigger 1 — Low Stock → Move to Real Lists

**Data Flow:**

**UI Detail:**

#### 7. Trigger 2 — Recipe Needs → Move to Real Lists

**Data Flow:**

**UI Detail:**

#### 8. Trigger 3 — Planned Batch → Move to Real Lists

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Move to Real Lists | entities/ShoppingListItem.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Suggested Items] | Move to Real Lists |
| 2 | [MOCK: Trigger Config] | Configuration |

---

## Shopping Trip

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Shopping Trip.md | Entry: Shopping Page |  |
| 2 | Entry: Shopping Page | Phase 1 — In-Store |  |
| 3 | Phase 1 — In-Store | In-Store Actions |  |
| 4 | Phase 1 — In-Store | Checkout Table | Check out |
| 5 | Checkout Table | Restock Resolution |  |
| 6 | Checkout Table | Confirm Checkout |  |
| 7 | Restock Resolution | Confirm Checkout |  |
| 8 | Confirm Checkout | After Checkout |  |

#### 1. journeys/Shopping Trip.md → Entry: Shopping Page

**Data Flow:**

**UI Detail:**

#### 2. Entry: Shopping Page → Phase 1 — In-Store

**Data Flow:**

**UI Detail:**

#### 3. Phase 1 — In-Store → In-Store Actions

**Data Flow:**

**UI Detail:**

#### 4. Phase 1 — In-Store → Checkout Table (Check out)

**Data Flow:**

**UI Detail:**

#### 5. Checkout Table → Restock Resolution

**Data Flow:**

**UI Detail:**

#### 6. Checkout Table → Confirm Checkout

**Data Flow:**

**UI Detail:**

#### 7. Restock Resolution → Confirm Checkout

**Data Flow:**

**UI Detail:**

#### 8. Confirm Checkout → After Checkout

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Confirm Checkout | entities/ShoppingListItem.md |  |
| 2 | Confirm Checkout | entities/Flow.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: In-Store Mode] | Phase 1 — In-Store |
| 2 | [MOCK: Checkout] | Confirm Checkout |

---

## Expiry Management

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Expiry Management.md | Entry: Nav Item |  |
| 2 | journeys/Expiry Management.md | Entry: Dashboard Widget |  |
| 3 | journeys/Expiry Management.md | Entry: Checking Stock Alerts |  |
| 4 | Entry: Nav Item | Tiered Thresholds |  |
| 5 | Entry: Dashboard Widget | Tiered Thresholds |  |
| 6 | Entry: Checking Stock Alerts | Tiered Thresholds |  |
| 7 | Tiered Thresholds | Tab 1 — Triage |  |
| 8 | Tab 1 — Triage | Triage Actions |  |
| 9 | Tiered Thresholds | Tab 2 — FIFO Planning |  |
| 10 | Tiered Thresholds | Tab 3 — Missing Dates |  |

#### 1. journeys/Expiry Management.md → Entry: Nav Item

**Data Flow:**

**UI Detail:**

#### 2. journeys/Expiry Management.md → Entry: Dashboard Widget

**Data Flow:**

**UI Detail:**

#### 3. journeys/Expiry Management.md → Entry: Checking Stock Alerts

**Data Flow:**

**UI Detail:**

#### 4. Entry: Nav Item → Tiered Thresholds

**Data Flow:**

**UI Detail:**

#### 5. Entry: Dashboard Widget → Tiered Thresholds

**Data Flow:**

**UI Detail:**

#### 6. Entry: Checking Stock Alerts → Tiered Thresholds

**Data Flow:**

**UI Detail:**

#### 7. Tiered Thresholds → Tab 1 — Triage

**Data Flow:**

**UI Detail:**

#### 8. Tab 1 — Triage → Triage Actions

**Data Flow:**

**UI Detail:**

#### 9. Tiered Thresholds → Tab 2 — FIFO Planning

**Data Flow:**

**UI Detail:**

#### 10. Tiered Thresholds → Tab 3 — Missing Dates

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Tab 1 — Triage | entities/InventoryItem.md |  |
| 2 | Triage Actions | entities/WasteEvent.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Triage Tab] | Tab 1 — Triage |
| 2 | [MOCK: FIFO Planning] | Tab 2 — FIFO Planning |
| 3 | [MOCK: Missing Dates Tab] | Tab 3 — Missing Dates |

---

## Logging Waste

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Logging Waste.md | Entry: Checking Stock |  |
| 2 | journeys/Logging Waste.md | Entry: Alerts (Expired) |  |
| 3 | journeys/Logging Waste.md | Entry: Dedicated Action |  |
| 4 | journeys/Logging Waste.md | Entry: Kiosk Mode |  |
| 5 | journeys/Logging Waste.md | Entry: Batch Failure |  |
| 6 | Entry: Checking Stock | Section 1 — Item Selection |  |
| 7 | Entry: Alerts (Expired) | Section 1 — Item Selection |  |
| 8 | Entry: Dedicated Action | Section 1 — Item Selection |  |
| 9 | Entry: Kiosk Mode | Section 1 — Item Selection |  |
| 10 | Entry: Batch Failure | Section 1 — Item Selection |  |
| 11 | Section 1 — Item Selection | Section 2 — Quantity |  |
| 12 | Section 2 — Quantity | Section 3 — Reason |  |
| 13 | Section 3 — Reason | Reason Details |  |
| 14 | Reason Details | Section 4 — Additional Context |  |
| 15 | Section 4 — Additional Context | Confirmation Step |  |
| 16 | Confirmation Step | On Confirm (Atomic) |  |

#### 1. journeys/Logging Waste.md → Entry: Checking Stock

**Data Flow:**

**UI Detail:**

#### 2. journeys/Logging Waste.md → Entry: Alerts (Expired)

**Data Flow:**

**UI Detail:**

#### 3. journeys/Logging Waste.md → Entry: Dedicated Action

**Data Flow:**

**UI Detail:**

#### 4. journeys/Logging Waste.md → Entry: Kiosk Mode

**Data Flow:**

**UI Detail:**

#### 5. journeys/Logging Waste.md → Entry: Batch Failure

**Data Flow:**

**UI Detail:**

#### 6. Entry: Checking Stock → Section 1 — Item Selection

**Data Flow:**

**UI Detail:**

#### 7. Entry: Alerts (Expired) → Section 1 — Item Selection

**Data Flow:**

**UI Detail:**

#### 8. Entry: Dedicated Action → Section 1 — Item Selection

**Data Flow:**

**UI Detail:**

#### 9. Entry: Kiosk Mode → Section 1 — Item Selection

**Data Flow:**

**UI Detail:**

#### 10. Entry: Batch Failure → Section 1 — Item Selection

**Data Flow:**

**UI Detail:**

#### 11. Section 1 — Item Selection → Section 2 — Quantity

**Data Flow:**

**UI Detail:**

#### 12. Section 2 — Quantity → Section 3 — Reason

**Data Flow:**

**UI Detail:**

#### 13. Section 3 — Reason → Reason Details

**Data Flow:**

**UI Detail:**

#### 14. Reason Details → Section 4 — Additional Context

**Data Flow:**

**UI Detail:**

#### 15. Section 4 — Additional Context → Confirmation Step

**Data Flow:**

**UI Detail:**

#### 16. Confirmation Step → On Confirm (Atomic)

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | On Confirm (Atomic) | entities/WasteEvent.md |  |
| 2 | On Confirm (Atomic) | entities/Flow.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Item Selection] | Section 1 — Item Selection |
| 2 | [MOCK: Reason Picker] | Section 3 — Reason |
| 3 | [MOCK: Confirmation] | Confirmation Step |

---

## Reviewing Waste History

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Reviewing Waste History.md | Entry: Nav Item |  |
| 2 | journeys/Reviewing Waste History.md | Entry: Dashboard Widget |  |
| 3 | journeys/Reviewing Waste History.md | Entry: Expiry Management |  |
| 4 | Entry: Nav Item | Filters |  |
| 5 | Entry: Dashboard Widget | Filters |  |
| 6 | Entry: Expiry Management | Filters |  |
| 7 | Filters | Layer 1 — Summary Cards |  |
| 8 | Layer 1 — Summary Cards | Layer 2 — Charts |  |
| 9 | Filters | Layer 3 — Event Log |  |
| 10 | Layer 3 — Event Log | Export |  |

#### 1. journeys/Reviewing Waste History.md → Entry: Nav Item

**Data Flow:**

**UI Detail:**

#### 2. journeys/Reviewing Waste History.md → Entry: Dashboard Widget

**Data Flow:**

**UI Detail:**

#### 3. journeys/Reviewing Waste History.md → Entry: Expiry Management

**Data Flow:**

**UI Detail:**

#### 4. Entry: Nav Item → Filters

**Data Flow:**

**UI Detail:**

#### 5. Entry: Dashboard Widget → Filters

**Data Flow:**

**UI Detail:**

#### 6. Entry: Expiry Management → Filters

**Data Flow:**

**UI Detail:**

#### 7. Filters → Layer 1 — Summary Cards

**Data Flow:**

**UI Detail:**

#### 8. Layer 1 — Summary Cards → Layer 2 — Charts

**Data Flow:**

**UI Detail:**

#### 9. Filters → Layer 3 — Event Log

**Data Flow:**

**UI Detail:**

#### 10. Layer 3 — Event Log → Export

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Layer 3 — Event Log | entities/WasteEvent.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Summary Cards] | Layer 1 — Summary Cards |
| 2 | [MOCK: Charts Dashboard] | Layer 2 — Charts |
| 3 | [MOCK: Event Log] | Layer 3 — Event Log |

---

## Inventory Audit

### Flow Edges

| # | From | To | Label |
|---|------|----|-------|
| 1 | journeys/Inventory Audit.md | Entry: Admin Page |  |
| 2 | journeys/Inventory Audit.md | Entry: Scheduled Job |  |
| 3 | journeys/Inventory Audit.md | Entry: Dashboard Alert |  |
| 4 | Entry: Admin Page | System Reconciliation | Reconciliation |
| 5 | Entry: Scheduled Job | System Reconciliation |  |
| 6 | Entry: Dashboard Alert | Review Discrepancies |  |
| 7 | Entry: Admin Page | Step 1 — Define Scope | Physical count |
| 8 | System Reconciliation | Review Discrepancies |  |
| 9 | System Reconciliation | Reconciliation Config |  |
| 10 | Step 1 — Define Scope | Step 2 — Count |  |
| 11 | Step 2 — Count | Step 3 — Review Discrepancies |  |
| 12 | Step 3 — Review Discrepancies | Step 4 — Complete Audit |  |
| 13 | Step 4 — Complete Audit | Audit History |  |

#### 1. journeys/Inventory Audit.md → Entry: Admin Page

**Data Flow:**

**UI Detail:**

#### 2. journeys/Inventory Audit.md → Entry: Scheduled Job

**Data Flow:**

**UI Detail:**

#### 3. journeys/Inventory Audit.md → Entry: Dashboard Alert

**Data Flow:**

**UI Detail:**

#### 4. Entry: Admin Page → System Reconciliation (Reconciliation)

**Data Flow:**

**UI Detail:**

#### 5. Entry: Scheduled Job → System Reconciliation

**Data Flow:**

**UI Detail:**

#### 6. Entry: Dashboard Alert → Review Discrepancies

**Data Flow:**

**UI Detail:**

#### 7. Entry: Admin Page → Step 1 — Define Scope (Physical count)

**Data Flow:**

**UI Detail:**

#### 8. System Reconciliation → Review Discrepancies

**Data Flow:**

**UI Detail:**

#### 9. System Reconciliation → Reconciliation Config

**Data Flow:**

**UI Detail:**

#### 10. Step 1 — Define Scope → Step 2 — Count

**Data Flow:**

**UI Detail:**

#### 11. Step 2 — Count → Step 3 — Review Discrepancies

**Data Flow:**

**UI Detail:**

#### 12. Step 3 — Review Discrepancies → Step 4 — Complete Audit

**Data Flow:**

**UI Detail:**

#### 13. Step 4 — Complete Audit → Audit History

**Data Flow:**

**UI Detail:**

### Entity References

| # | From | To (Entity) | Label |
|---|------|-------------|-------|
| 1 | Review Discrepancies | entities/Flow.md |  |
| 2 | Review Discrepancies | entities/InventoryItem.md |  |

### Mock References

| # | Mock | Illustrates |
|---|------|-------------|
| 1 | [MOCK: Reconciliation Review] | System Reconciliation |
| 2 | [MOCK: Count Sheet] | Step 2 — Count |
| 3 | [MOCK: Audit Summary] | Step 4 — Complete Audit |

---

## Cross-Journey Links

| # | From (Journey) | From Node | To (Journey) | To Node | Label |
|---|----------------|-----------|--------------|---------|-------|
| 1 | Onboarding | Step 5 — Set Up Spaces | Space Setup | journeys/Space Setup.md | Detailed journey |
| 2 | Onboarding | Step 6 — Add First Items | Adding Inventory | journeys/Adding Inventory.md | Detailed journey |
| 3 | Checking Stock | Inline Actions | Moving Items | journeys/Moving Items.md | Move/Put back |
| 4 | Expiry Management | Triage Actions | Logging Waste | journeys/Logging Waste.md | Waste it |
| 5 | Checking Stock | Inline Actions | Logging Waste | journeys/Logging Waste.md | Log waste |
| 6 | Logging Waste | On Confirm (Atomic) | Reviewing Waste History | journeys/Reviewing Waste History.md | Feeds data to |
| 7 | Creating a Recipe | After Creation | Editing a Recipe | journeys/Editing a Recipe.md | Edit |
| 8 | Creating a Recipe | After Creation | Cooking a Meal | journeys/Cooking a Meal.md | Start batch |
| 9 | Cooking a Meal | Waste Path | Logging Waste | journeys/Logging Waste.md | Batch failure waste |
| 10 | Creating a Recipe | After Creation | Prepping for Storage | journeys/Prepping for Storage.md | Start prep batch |
| 11 | Prepping for Storage | Steps 1–3 — Shared with Cooking a Meal | Cooking a Meal | Step 1 — Select & Scale | Shared Steps 1–3 |
| 12 | Auto-Generated Shopping List | Move to Real Lists | Building a Shopping List | List View | Move to list |
| 13 | Building a Shopping List | List View | Shopping Trip | journeys/Shopping Trip.md | Start shopping |
| 14 | Shopping Trip | After Checkout | Intake Session | journeys/Intake Session.md | Start intake |

#### 1. [Onboarding] Step 5 — Set Up Spaces → [Space Setup] journeys/Space Setup.md (Detailed journey)

**Data Flow:**

**UI Detail:**

#### 2. [Onboarding] Step 6 — Add First Items → [Adding Inventory] journeys/Adding Inventory.md (Detailed journey)

**Data Flow:**

**UI Detail:**

#### 3. [Checking Stock] Inline Actions → [Moving Items] journeys/Moving Items.md (Move/Put back)

**Data Flow:**

**UI Detail:**

#### 4. [Expiry Management] Triage Actions → [Logging Waste] journeys/Logging Waste.md (Waste it)

**Data Flow:**

**UI Detail:**

#### 5. [Checking Stock] Inline Actions → [Logging Waste] journeys/Logging Waste.md (Log waste)

**Data Flow:**

**UI Detail:**

#### 6. [Logging Waste] On Confirm (Atomic) → [Reviewing Waste History] journeys/Reviewing Waste History.md (Feeds data to)

**Data Flow:**

**UI Detail:**

#### 7. [Creating a Recipe] After Creation → [Editing a Recipe] journeys/Editing a Recipe.md (Edit)

**Data Flow:**

**UI Detail:**

#### 8. [Creating a Recipe] After Creation → [Cooking a Meal] journeys/Cooking a Meal.md (Start batch)

**Data Flow:**

**UI Detail:**

#### 9. [Cooking a Meal] Waste Path → [Logging Waste] journeys/Logging Waste.md (Batch failure waste)

**Data Flow:**

**UI Detail:**

#### 10. [Creating a Recipe] After Creation → [Prepping for Storage] journeys/Prepping for Storage.md (Start prep batch)

**Data Flow:**

**UI Detail:**

#### 11. [Prepping for Storage] Steps 1–3 — Shared with Cooking a Meal → [Cooking a Meal] Step 1 — Select & Scale (Shared Steps 1–3)

**Data Flow:**

**UI Detail:**

#### 12. [Auto-Generated Shopping List] Move to Real Lists → [Building a Shopping List] List View (Move to list)

**Data Flow:**

**UI Detail:**

#### 13. [Building a Shopping List] List View → [Shopping Trip] journeys/Shopping Trip.md (Start shopping)

**Data Flow:**

**UI Detail:**

#### 14. [Shopping Trip] After Checkout → [Intake Session] journeys/Intake Session.md (Start intake)

**Data Flow:**

**UI Detail:**
