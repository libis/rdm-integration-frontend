// E2E-like test to reproduce empty SHACL form rendering for LogicalDataSets
/* eslint-disable no-console */

import '../shacl-form-patch';
import { Parser } from 'n3';

// Small async helper to wait for the web component to render
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Extract the first DataSet subject IRI from Turtle using N3 parser
function getDatasetSubject(turtle: string): string | undefined {
  const parser = new Parser();
  const quads = parser.parse(turtle);
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const CDI_DATASET =
    'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/DataSet';
  const hit = quads.find(
    (q) =>
      q.predicate.value === RDF_TYPE &&
      q.object.termType === 'NamedNode' &&
      q.object.value === CDI_DATASET,
  );
  return hit?.subject.value;
}

// Build SHACL shapes content from the fallback template used by the component
function buildShapesForTargetNode(targetNodeIri: string): string {
  const template = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:ddi-cdi:DatasetShape> a sh:NodeShape;
   sh:targetNode __TARGET_NODE__;
   sh:targetClass cdi:DataSet;
   sh:class cdi:DataSet;
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Dataset identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:title;
     sh:name "Dataset title";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
   ];
   sh:property [
     sh:path cdi:hasLogicalDataSet;
     sh:name "Logical data sets";
     sh:minCount 1;
  sh:nodeKind sh:BlankNode;
     sh:class cdi:LogicalDataSet;
     sh:node <urn:ddi-cdi:LogicalDataSetShape>;
   ];
   sh:property [
     sh:path cdi:hasPhysicalDataSet;
     sh:name "Physical data sets";
     sh:minCount 1;
  sh:nodeKind sh:BlankNode;
     sh:node <urn:ddi-cdi:PhysicalDataSetShape>;
   ];
   sh:property [
     sh:path prov:wasGeneratedBy;
     sh:name "Generation process";
     sh:minCount 1;
  sh:nodeKind sh:BlankNode;
     sh:node <urn:ddi-cdi:ProcessStepShape>;
   ].

<urn:ddi-cdi:PhysicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:PhysicalDataSet;
   sh:property [
     sh:path dcterms:format;
     sh:name "File format";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:name "File access URI";
     sh:nodeKind sh:IRI;
     sh:minCount 0;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:provenance;
     sh:name "File checksum";
     sh:datatype xsd:string;
     sh:pattern "^md5:[0-9a-f]{32}$";
     sh:minCount 0;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:source;
     sh:name "Source DDI";
     sh:nodeKind sh:Literal;
     sh:minCount 0;
   ].

<urn:ddi-cdi:LogicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:LogicalDataSet;
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Logical dataset identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Logical dataset label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:description;
     sh:name "Logical dataset description";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:containsVariable;
     sh:name "Variables";
     sh:minCount 1;
     sh:nodeKind sh:IRI;
     sh:class cdi:Variable;
     sh:node <urn:ddi-cdi:VariableShape>;
   ].

<urn:ddi-cdi:VariableShape> a sh:NodeShape;
   sh:targetClass cdi:Variable;
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Primary label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:altLabel;
     sh:name "Alternative label";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Variable identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasRepresentation;
     sh:name "Variable datatype";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
     sh:in (
       xsd:boolean
       xsd:dateTime
       xsd:decimal
       xsd:integer
       xsd:string
     );
   ];
   sh:property [
     sh:path cdi:hasRole;
     sh:name "Variable role";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
     sh:node <urn:ddi-cdi:RoleShape>;
   ];
   sh:property [
     sh:path skos:note;
     sh:name "Variable note";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
   ].

<urn:ddi-cdi:RoleShape> a sh:NodeShape;
   sh:targetClass cdi:Role;
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Role label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
     sh:in (
       "identifier"
       "measure"
       "dimension"
       "attribute"
     );
   ].

<urn:ddi-cdi:ProcessStepShape> a sh:NodeShape;
   sh:targetClass cdi:ProcessStep;
   sh:property [
     sh:path dcterms:description;
     sh:name "Generation description";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ].
`;
  // Use split/join for broader TS lib compatibility
  return template.split('__TARGET_NODE__').join(`<${targetNodeIri}>`);
}

// Provided realistic CDI Turtle (trimmed straight from the user JSON)
// NOTE: Keep it raw; the form parses it directly as text/turtle
const realisticTurtle = `@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM> a cdi:DataSet ;
    dcterms:creator [ a prov:Agent ;
            skos:prefLabel "Admin, Dataverse" ] ;
    dcterms:description "Test" ;
    dcterms:identifier "doi:10.5072/FK2/HWBVZM" ;
    dcterms:license <http://www.apache.org/licenses/LICENSE-2.0> ;
    dcterms:publisher "Root" ;
    dcterms:rights "Apache-2.0" ;
    dcterms:subject "Agricultural Sciences" ;
    dcterms:title "Test" ;
    cdi:hasLogicalDataSet <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_no_header_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_semicolon_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_tab_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_types_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_with_missing_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_dct>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_sas>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_sps> .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_no_header_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample_no_header.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_no_header_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_2>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_3>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_4>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_5>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_6> ;
    skos:prefLabel "Logical dataset: sample_no_header.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_semicolon_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample_semicolon.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_semicolon_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1> ;
    skos:prefLabel "Logical dataset: sample_semicolon.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_2>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_3>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_4>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_5>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_6> ;
    skos:prefLabel "Logical dataset: sample.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_tab_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample_tab.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_tab_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_2>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_3> ;
    skos:prefLabel "Logical dataset: sample_tab.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_types_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample_types.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_types_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_2>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_3>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_4>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_5> ;
    skos:prefLabel "Logical dataset: sample_types.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_sample_with_missing_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample_with_missing.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_with_missing_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_2>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_3>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_4> ;
    skos:prefLabel "Logical dataset: sample_with_missing.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_dct> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: simple_data.dct""" ;
    dcterms:identifier "logical-dataset-logical_simple_data_dct" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/Stata>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/_>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/data>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/definition>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/file> ;
    skos:prefLabel "Logical dataset: simple_data.dct" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_sas> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: simple_data.sas""" ;
    dcterms:identifier "logical-dataset-logical_simple_data_sas" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/col_1> ;
    skos:prefLabel "Logical dataset: simple_data.sas" .

<http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#logical/logical_simple_data_sps> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: simple_data.sps""" ;
    dcterms:identifier "logical-dataset-logical_simple_data_sps" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/AGE>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/DATA>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/EDUCATION_>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/FREE>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/GENDER>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/ID>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/INCOME>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/LIST>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/HWBVZM#var/_> ;
    skos:prefLabel "Logical dataset: simple_data.sps" .
`;

describe('shacl-form rendering with realistic CDI data', () => {
  it('should render non-empty form controls for Dataset and nested LogicalDataSets', async () => {
    const datasetIri = getDatasetSubject(realisticTurtle);
    expect(datasetIri).withContext('Dataset subject IRI should be discovered').toBeTruthy();

    const shapes = buildShapesForTargetNode(datasetIri!);

    // Create and configure the web component similar to the app component
    const form = document.createElement('shacl-form') as HTMLElement & {
      dataShapes?: string;
      dataShapesFormat?: string;
      dataShapeSubject?: string;
      dataValues?: string;
      dataValuesFormat?: string;
      dataValuesSubject?: string;
    };

    // Attributes
    form.setAttribute('data-shapes', shapes);
    form.setAttribute('data-shapes-format', 'text/turtle');
    form.setAttribute('data-values', realisticTurtle);
    form.setAttribute('data-values-format', 'text/turtle');
    form.setAttribute('data-shape-subject', 'urn:ddi-cdi:DatasetShape');
    form.setAttribute('data-values-subject', datasetIri!);
    form.setAttribute('data-dense', 'true');

    // Properties as well (some web components rely on properties not attributes)
    form.dataShapes = shapes;
    form.dataShapesFormat = 'text/turtle';
    form.dataShapeSubject = 'urn:ddi-cdi:DatasetShape';
    form.dataValues = realisticTurtle;
    form.dataValuesFormat = 'text/turtle';
    form.dataValuesSubject = datasetIri!;

    document.body.appendChild(form);

    // Give the component time to upgrade and render
    await sleep(700);

    // Try a second nudge
    form.dispatchEvent(new CustomEvent('load', { bubbles: true }));
    await sleep(700);

    const shadow = (form.shadowRoot ?? (form as any).renderRoot) as ShadowRoot | undefined;

    // Query for any interactive controls commonly used by the component
    const controls = shadow
      ? shadow.querySelectorAll(
          [
            'input',
            'textarea',
            'select',
            'ro-input',
            'ro-select',
            'ro-textarea',
            'rokit-input',
            'rokit-select',
            'rokit-textarea',
          ].join(', '),
        )
      : (form.querySelectorAll('input, textarea, select') as NodeListOf<Element>);

    // Expect multiple controls to be present if the form rendered properly
    expect(controls.length)
      .withContext('The SHACL form rendered zero controls — the form is EMPTY')
      .toBeGreaterThan(2);

    // Cleanup
    form.remove();
  });
});
