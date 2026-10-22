## v0.5.0-beta

### Heads-up

**Stored costs are re-priced on first start.** After upgrading, the server
recalculates the cost of every stored usage entry in the background, using the
new price table. Reported costs change — in some cases substantially, see
*Fixed* below. The hub keeps serving requests while this runs, and resumes
where it left off if restarted. Expect a few minutes of extra CPU on large
databases.

**Sign-up now requires an invite or a domain rule.** Google sign-in no longer
creates an account for any address on an allowed domain. Make sure every
existing member belongs to a workspace before upgrading — members without one
are asked to contact an admin when they sign in (the platform owner is exempt).
Collectors keep uploading either way.

Collectors do **not** need reinstalling. Reinstall only to pick up the 5-minute
/ 1-hour cache-write split (see *Added*).

### Fixed

**Costs were wrong for every Claude model newer than Opus 4.7 / Sonnet 4.6**

The price table stopped at Opus 4.7, Sonnet 4.6 and Haiku 4.5. Anything newer —
Opus 4.8, 5 and 5.5, Sonnet 5 and 5.5, Fable 5 and 5.1, Haiku 5.5 — fell back to
Sonnet 4.6 rates. Opus and Fable usage was under-reported and Sonnet 5.x
over-reported. The table now covers every current model from the official
pricing page.

**Cache pricing used fixed multipliers**

Newer models price cache reads at 0.05× (Opus 5.5, Sonnet 5.5) or 0.025×
(Fable 5.1) of input rather than 0.1×. Rates are now listed per model, with
separate 5-minute and 1-hour cache-write prices.

**Haiku 5.5 long-context pricing**

Prompts over 100K tokens are billed at Haiku 5.5's higher tier.

**Non-Claude models were priced as Sonnet**

Other providers' models routed through Claude Code are now counted at $0.

**Fable / Mythos usage was missing from Cost Comparison**

It now counts in the flagship tier alongside Opus.

**Invites could place a user in another organization's workspace**

An invite naming an organization but no workspace fell back to the platform's
default workspace, which may belong to a different organization. Every invite
now requires both an organization and a workspace — Platform Admin invites
included, reversing the 0.4.5 change — and accepting an invite never falls back.

### Changed

**The server prices usage, not the collector**

Every entry is costed from its token counts when it arrives, so collectors
installed before a price change can no longer record stale prices.

**New models are priced automatically**

An unlisted Claude model takes the price of the nearest listed version of its
family — a future Opus is priced like the newest Opus. A model from an unknown
family is priced like the newest Opus. These costs are marked *estimated*, and
platform admins see a banner until a release adds the official price.

**Model names include the version**

"Opus 5.5", "Fable 5.1", "Haiku 4.5" — derived from the model id, so future
versions display correctly. Fable has its own colour; charts still group by
family.

**Workspace switcher**

Switching organization selects its default workspace, which is pinned to the
top. The list sorts case-insensitively and scrolls instead of growing past the
screen.

### Added

**Manage → Models**

Every model seen in usage data, the price applied to it, and whether that price
is listed, estimated or not applicable.

**Pagination on every list table** — 25 rows per page.

**Members page: workspace filter**, and workspace names instead of ids, also in
the Grants dialog.

**Cache-write split** — the collector reports how much of each cache write used
the 5-minute vs the 1-hour TTL, and the server bills each at its own rate.
Entries without the split are billed at the 1-hour rate, Claude Code's default.

### Updating prices

Edit `CLAUDE_PRICING` in `packages/shared/src/pricing.ts` from the
[official pricing page](https://platform.claude.com/docs/en/about-claude/pricing)
and bump `PRICING_VERSION`. Stored entries are re-priced on the next start.
