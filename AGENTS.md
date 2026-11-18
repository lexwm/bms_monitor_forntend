# Frontend working agreements

Read README.md and docs/deployment.md before changes.
TypeScript strict with noUncheckedIndexedAccess/exactOptionalPropertyTypes; no any or assertions replacing boundary validation. Decode external JSON against generated schemas. contracts/openapi.json is a copied backend contract: change backend first, then sync and regenerate; never hand-edit generated code.
Reuse components/styles, preserve accessibility/mobile layout. Missing is not zero; do not hide stale/invalid data or bridge gaps. Keep one EventSource and the approved bounded recovery; no periodic polling. Visual redesign requires its own task.
Ukrainian is the only interface language, including labels, tooltips, errors, chart legends, accessibility text and the page title. Any interface text in another language is a defect. Use uk-UA formatting and html lang="uk"; protocol identifiers and standard measurement symbols are not translated.
Use container Node locally. Production receives only built static files and handoff docs, never a Vite/Node runtime. Documentation is not authorization for server changes.
No commit or push without separate explicit current user instructions. No automatic deployment. Preserve unrelated files; keep changes minimal and within scope. Report verified outcomes in plain Russian.
