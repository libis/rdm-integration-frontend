# DDI-CDI SHACL Form Fix

**Status:** ✅ Resolved locally – generator + guard keep all logical datasets visible  \
**Last Updated:** 2025-10-28 (post generator metadata fix + runtime guard)  \
**Scope:** `src/app/ddi-cdi/ddi-cdi.component.ts`, `src/app/ddi-cdi/ddi-cdi.logical-physical-parity.spec.ts`, `image/app/frontend/default_shacl_shapes.ttl`, `image/cdi_generator.py`, `test_logical_dataset.py`

## 1. Context
- The DDI-CDI specification (see `ddi-cdi/README.rst`) models each physical file as a `cdi:LogicalDataSet` with identifier, label, description, and variable links. Losing any node breaks the datum-level traceability that DDI-CDI promises.
- The Angular frontend renders and edits this RDF via `@ulb-darmstadt/shacl-form` v2.0.0-rc14. Shape and value graphs arrive as Turtle/TriG produced by the backend.

## 2. Observed Symptoms
- UI showed only one blank LogicalDataSet even when nine were present.
- Saving the form discarded 8/9 LogicalDataSets, stripping identifiers, descriptions, and variable references.
- Unit test `ddi-cdi.component.spec.ts` reproduced the regression with production RDF (`real-9-logical-datasets-full.ttl`).

## 3. Current Understanding
- The SHACL form renders only a single logical dataset even when the graph contains multiple blank-node `cdi:hasLogicalDataSet` values. Its `serialize()` output therefore includes a value graph for just the visible node.
- Our merge logic hardening ensures extra blank-node triples are preserved *if* the serialized data still references them, but once the component overwrites `generatedDdiCdi` with the truncated graph we lose the untouched nodes before the merge runs.
- This behaviour appears to stem from the `@ulb-darmstadt/shacl-form` web component: it likely lacks support for multi-valued blank-node properties (or has a bug) and silently drops all but the first entry. No evidence yet that the issue lives in our Angular glue code.

## 4. Recent Changes
1. **Merge logic hardening** – `ddi-cdi.component.ts` now recognises multi-valued predicates (`cdi:hasLogicalDataSet`, `cdi:hasPhysicalDataSet`, `cdi:containsVariable`) and keeps untouched base triples when the SHACL form omits them. This protects data only if the serialized graph still mentions the extra nodes.
2. **Predicate classification helpers** – Added subject/predicate/object key helpers and a `multiValuePredicates` registry so we only drop base statements when an update represents an intentional overwrite.
3. **Targeted regression spec** – Expanded `ddi-cdi.component.spec.ts` with a multi-logical dataset fixture ensuring the merge preserves unedited blank nodes while still applying edits to the touched logical dataset. The spec passes because it bypasses the SHACL form and feeds the merge helper directly.
4. **Logical dataset metadata injection** – `cdi_generator.py` now guarantees every logical dataset blank node carries `dcterms:identifier`, `skos:prefLabel`, and an informative description so the SHACL validator no longer flags the records as invalid.
5. **Existing shape & generator parity** – Prior work enforcing blank nodes in the shapes file and backend generator remains in place so the form receives and emits consistent blank-node graphs.

## 5. Validation
- **Angular targeted tests**
  - `ng test --include src/app/ddi-cdi/logical-dataset.response.spec.ts --watch=false`
  - `ng test --include src/app/ddi-cdi/logical-dataset.multi.spec.ts --watch=false`
  - `ng test --include src/app/ddi-cdi/ddi-cdi.form.e2e.spec.ts --watch=false`
  - Confirms the guarded shacl-form keeps every logical dataset entry and the existing e2e smoke still passes.
- **Angular lint**: `npm run lint`
  - Verifies the new patch file and specs satisfy the workspace coding standards.
- **Generator smoke test**: `cd rdm-integration && .venv/bin/python test_logical_dataset.py`
  - Verifies generator output links to blank-node LogicalDataSets with all required metadata and keeps PhysicalDataSets as blank nodes.
  - Confirms parity between backend output and SHACL expectations.
- **End-to-end stack run (2025-10-28, rebuilt + make test + make dev_up)**
  - Backend regeneration for `doi:10.5072/FK2/HWBVZM` now emits nine logical dataset blank nodes, each with identifier, label, and description as expected.
  - Frontend renders all nine logical datasets with the runtime guard in place; no nodes disappear during editing.
  - Saving without edits keeps every logical dataset in the persisted Turtle, confirming the SHACL form no longer prunes untouched nodes when upstream data is compliant.
  - Regression scenario with two-file datasets retains both logical datasets before and after save; manual field edits continue to round-trip correctly.

## 6. Manual Verification (2025-10-28)
1. Rebuilt and restarted the stack (`make test`, `make dev_build`, `make dev_up`) to load the updated SHACL shapes and generator output.
2. Regenerated CDI metadata for `doi:10.5072/FK2/HWBVZM`; confirmed the Turtle contains nine logical datasets with the required identifier/label/description triples.
3. Opened the frontend form: all logical datasets appeared immediately and survived navigation between nodes.
4. Saved without changes and inspected the resulting Turtle via the API; all nine logical datasets persisted with their metadata intact.
5. Edited a single logical dataset label and re-saved; only the targeted node changed while the untouched nodes remained untouched.

## 7. Follow-up
- No changes were made to the vendored shacl-form sources or to the DDI-CDI specification; the fix relies on compliant generator output plus the lightweight frontend guard.
- Keep the guard in place until upstream shacl-form ships the filtering fix so legacy CDI files missing identifiers still render.
- Consider adding an end-to-end regression test to catch future regressions and to monitor legacy datasets that may still lack the required metadata.

## 8. Active Work Plan (2025-10-28)
1. Promote the runtime guard into an upstream fix: update `@ulb-darmstadt/shacl-form` so `filterValidValues` skips validation filtering when no `sh:qualifiedValueShape` is involved.
2. Replace the temporary patch once the upstream release lands; remove the prototype override and depend on the new package.
3. Maintain the regression specs so any regression in blank-node handling is caught immediately.
