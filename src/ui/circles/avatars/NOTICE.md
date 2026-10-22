# Avatar attribution and licence

Member avatars are drawn with **Bible Strong Avatar Lab**
(<https://github.com/smontlouis/bible-strong-avatar-lab>, © its authors), used through the published packages
`@bible-strong/avatar-react@0.1.0` and `@bible-strong/avatar-core@0.1.0`.

- Licence of those packages: **GNU AGPL-3.0-only**.
- `base.avatar.json` is the `strobi.avatar.json` example from that repository's `examples/react-vite-consumer`,
  unmodified. Per-member variation (body colour and expression) is applied in code in `avatar-lab.tsx`.

## What this means for the project

Distributing software that includes AGPL-3.0 code makes the whole combined work AGPL-3.0. The hackathon allows
AGPL-3.0 as the repository licence, so this is compatible **only if the root `LICENSE` is AGPL-3.0**
(owned by Track C). If the team chooses MIT or Apache-2.0 instead, remove `avatar-lab.tsx`, `base.avatar.json`
and the two npm dependencies, and in `src/components/circles/MemberAvatar.tsx` render the `fallback` (the initials
circle from the mockups) instead of `<LabAvatar>`.

This is not xAI or Grok software, and no affiliation is implied.
