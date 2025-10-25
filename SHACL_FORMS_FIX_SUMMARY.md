# SHACL Forms Fix Summary

## Problem
LogicalDataSet forms in the DDI-CDI component were appearing empty despite the backend generating correct RDF data with all required properties.

## Root Cause
The SHACL form component (`@ulb-darmstadt/shacl-form`) renders form fields based on **SHACL shape property definitions**, not directly from the RDF data. The `LogicalDataSetShape` was missing critical property definitions.

## Technical Explanation
SHACL forms use shape definitions (`sh:property`) to determine:
1. **Which properties to display** as form fields
2. **Field labels** (from `sh:name`)
3. **Validation rules** (from `sh:minCount`, `sh:maxCount`, etc.)
4. **Data types** (from `sh:datatype`)

Without these shape definitions, the form **cannot render input fields**, even when the RDF data contains the values.

## The Fix

### Backend: `/home/eryk/projects/rdm-integration/image/app/frontend/default_shacl_shapes.ttl`

**Added three missing properties to `LogicalDataSetShape`:**

```turtle
<urn:ddi-cdi:LogicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:LogicalDataSet;
   sh:property [
     sh:path dcterms:identifier;              # ← ADDED
     sh:name "Logical dataset identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:prefLabel;                  # ← ADDED
     sh:name "Logical dataset label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:description;             # ← ADDED
     sh:name "Logical dataset description";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:containsVariable;            # ← Already existed
     sh:name "Variables";
     sh:minCount 1;
     sh:nodeKind sh:IRI;
     sh:class cdi:Variable;
     sh:node <urn:ddi-cdi:VariableShape>;
   ].
```

### Frontend: `/home/eryk/projects/rdm-integration-frontend/src/app/ddi-cdi/ddi-cdi.component.ts`

**Updated `fallbackShaclTemplate` to match backend template** (lines 232-257)

This ensures the frontend uses the same SHACL shape definitions even if the backend template fails to load.

## Additional Fixes

### 1. LogicalDataSet URI Generation (`cdi_generator.py`)
**Problem:** Files with same base name but different extensions created collisions.
- Example: `simple_data.dct`, `simple_data.sas`, `simple_data.sps` all mapped to `#logical/logical_simple_data`

**Solution:** Changed from stripping extension to using **full filename**:
```python
# OLD (caused collision):
base_name = file_name.rsplit('.', 1)[0]  # → "simple_data"
logical_frag = safe_uri_fragment(f"logical_{base_name}")

# NEW (unique URIs):
logical_frag = safe_uri_fragment(f"logical_{file_name}")  # → "simple_data_dct", "simple_data_sas", etc.
```

Result:
- ✅ `simple_data.dct` → `#logical/logical_simple_data_dct`
- ✅ `simple_data.sas` → `#logical/logical_simple_data_sas`
- ✅ `simple_data.sps` → `#logical/logical_simple_data_sps`

### 2. Dark Mode CSS Variables (`ddi-cdi.component.scss`)
Fixed SHACL form styling by overriding CSS custom properties that inherit into shadow DOM:

```scss
shacl-form {
  // Critical -inner suffix variables for shadow DOM content
  --rokit-background-color-inner: var(--p-form-field-background);
  --rokit-light-background-color-inner: var(--p-content-background);
  --rokit-light-background-darker-color-inner: var(--p-surface-100);
  
  // Additional theme mappings
  --rokit-background-color: var(--p-form-field-background);
  --rokit-surface-color: var(--p-content-background);
  --rokit-text-color: var(--p-form-field-color);
  // ... (other color overrides)
}
```

## Testing

Created comprehensive test: `/home/eryk/projects/rdm-integration-frontend/src/app/ddi-cdi/ddi-cdi.shacl.spec.ts`

The test verifies:
1. ✅ RDF data contains multiple unique LogicalDataSet URIs
2. ✅ Each LogicalDataSet has exactly one `dcterms:identifier`, `skos:prefLabel`, and `dcterms:description`
3. ✅ SHACL shape defines properties for all three critical fields
4. ✅ Shape properties include proper constraints (`sh:minCount`, `sh:maxCount`, `sh:datatype`)

**Test Results:** 4 SUCCESS

## Deployment

1. Backend: Rebuild Docker image with updated SHACL template
   ```bash
   cd /home/eryk/projects/rdm-integration
   make dev_build
   docker compose restart integration
   ```

2. Frontend: Build with updated TypeScript fallback template
   ```bash
   cd /home/eryk/projects/rdm-integration-frontend
   npm run build
   ```

## Expected Outcome

After regenerating DDI-CDI metadata in Dataverse:
- ✅ Each tabular file gets a unique LogicalDataSet form
- ✅ Forms display editable fields for identifier, label, and description
- ✅ Dark mode styling works correctly
- ✅ No white-on-white text in form inputs
- ✅ All properties follow SHACL validation rules

## Files Modified

**Backend:**
- `/home/eryk/projects/rdm-integration/image/app/frontend/default_shacl_shapes.ttl` - Added LogicalDataSet properties
- `/home/eryk/projects/rdm-integration/image/cdi_generator.py` - Fixed URI generation

**Frontend:**
- `/home/eryk/projects/rdm-integration-frontend/src/app/ddi-cdi/ddi-cdi.component.ts` - Updated fallback template
- `/home/eryk/projects/rdm-integration-frontend/src/app/ddi-cdi/ddi-cdi.component.scss` - Fixed dark mode CSS
- `/home/eryk/projects/rdm-integration-frontend/src/app/ddi-cdi/ddi-cdi.shacl.spec.ts` - **New test file**

## Key Lessons

1. **SHACL forms require shape definitions** - RDF data alone is not sufficient
2. **Shadow DOM requires CSS custom properties** - Selectors don't penetrate, only variables inherit
3. **URI uniqueness is critical** - Multiple values on single-value properties break forms
4. **Test SHACL parsing** - Verify both data structure and shape definitions independently
