import '../shacl-form-patch';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const datasetTurtle = `@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix prov: <http://www.w3.org/ns/prov#> .

<http://example.org/dataset/1> a cdi:DataSet ;
  dcterms:identifier "doi:10.1234/ABC" ;
  cdi:hasLogicalDataSet [
    a cdi:LogicalDataSet ;
    dcterms:identifier "logical-ds-1" ;
    skos:prefLabel "Logical dataset #1" ;
    dcterms:description "First logical dataset" ;
    cdi:containsVariable <http://example.org/dataset/1#var/id> ;
  ], [
    a cdi:LogicalDataSet ;
    dcterms:identifier "logical-ds-2" ;
    skos:prefLabel "Logical dataset #2" ;
    dcterms:description "Second logical dataset" ;
    cdi:containsVariable <http://example.org/dataset/1#var/id> ;
  ] ;
  cdi:hasPhysicalDataSet [
    a cdi:PhysicalDataSet ;
    dcterms:identifier <http://example.org/file/tab1> ;
    dcterms:format "text/tab-separated-values" ;
  ] ;
  prov:wasGeneratedBy [ a prov:Activity ] .

<http://example.org/dataset/1#var/id> a cdi:Variable ;
  dcterms:identifier "id" ;
  skos:prefLabel "Identifier" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/1#role/id> .

<http://example.org/dataset/1#role/id> a cdi:Role ;
  skos:prefLabel "attribute" .
`;

const shapesTurtle = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:test:DatasetShape> a sh:NodeShape ;
  sh:targetNode <http://example.org/dataset/1> ;
  sh:targetClass cdi:DataSet ;
  sh:class cdi:DataSet ;
  sh:property [
    sh:path dcterms:identifier ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path cdi:hasLogicalDataSet ;
    sh:name "Logical data sets" ;
    sh:minCount 1 ;
    sh:nodeKind sh:BlankNode ;
    sh:class cdi:LogicalDataSet ;
    sh:node <urn:test:LogicalDataSetShape> ;
  ] ;
  sh:property [
    sh:path cdi:hasPhysicalDataSet ;
    sh:name "Physical data sets" ;
    sh:minCount 0 ;
    sh:nodeKind sh:BlankNode ;
    sh:node <urn:test:PhysicalDataSetShape> ;
  ] ;
  sh:property [
    sh:path prov:wasGeneratedBy ;
    sh:name "Generation process" ;
    sh:minCount 0 ;
    sh:nodeKind sh:BlankNode ;
    sh:node <urn:test:ProcessShape> ;
  ] .

<urn:test:LogicalDataSetShape> a sh:NodeShape ;
  sh:targetClass cdi:LogicalDataSet ;
  sh:property [
    sh:path dcterms:identifier ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path skos:prefLabel ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path dcterms:description ;
    sh:datatype xsd:string ;
    sh:minCount 0 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path cdi:containsVariable ;
    sh:minCount 1 ;
    sh:nodeKind sh:IRI ;
    sh:class cdi:Variable ;
    sh:node <urn:test:VariableShape> ;
  ] .

<urn:test:VariableShape> a sh:NodeShape ;
  sh:targetClass cdi:Variable ;
  sh:property [
    sh:path dcterms:identifier ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path skos:prefLabel ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path cdi:hasRepresentation ;
    sh:nodeKind sh:IRI ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path cdi:hasRole ;
    sh:nodeKind sh:IRI ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
    sh:node <urn:test:RoleShape> ;
  ] .

<urn:test:RoleShape> a sh:NodeShape ;
  sh:targetClass cdi:Role ;
  sh:property [
    sh:path skos:prefLabel ;
    sh:datatype xsd:string ;
    sh:minCount 1 ;
    sh:maxCount 1 ;
  ] .

<urn:test:PhysicalDataSetShape> a sh:NodeShape ;
  sh:targetClass cdi:PhysicalDataSet ;
  sh:property [
    sh:path dcterms:identifier ;
    sh:nodeKind sh:IRI ;
    sh:minCount 0 ;
    sh:maxCount 1 ;
  ] ;
  sh:property [
    sh:path dcterms:format ;
    sh:datatype xsd:string ;
    sh:minCount 0 ;
    sh:maxCount 1 ;
  ] .

<urn:test:ProcessShape> a sh:NodeShape ;
  sh:targetClass prov:Activity .
`;

describe('shacl-form multi logical dataset support', () => {
  it('renders both logical dataset blank nodes from existing data', async () => {
    const form = document.createElement('shacl-form') as HTMLElement & {
      dataShapes?: string;
      dataShapesFormat?: string;
      dataValues?: string;
      dataValuesFormat?: string;
      dataValuesSubject?: string;
      dataShapeSubject?: string;
    };

    form.setAttribute('data-shapes', shapesTurtle);
    form.setAttribute('data-shapes-format', 'text/turtle');
    form.setAttribute('data-values', datasetTurtle);
    form.setAttribute('data-values-format', 'text/turtle');
    form.setAttribute('data-values-subject', 'http://example.org/dataset/1');
    form.setAttribute('data-shape-subject', 'urn:test:DatasetShape');

    form.dataShapes = shapesTurtle;
    form.dataShapesFormat = 'text/turtle';
    form.dataValues = datasetTurtle;
    form.dataValuesFormat = 'text/turtle';
    form.dataValuesSubject = 'http://example.org/dataset/1';
    form.dataShapeSubject = 'urn:test:DatasetShape';

    document.body.appendChild(form);

    await sleep(800);
    await sleep(800);

    const shadow = form.shadowRoot ?? (form as any).renderRoot;

    const logicalDatasetInstances = shadow
      ? shadow.querySelectorAll(
          "[data-path='http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/hasLogicalDataSet']",
        )
      : form.querySelectorAll(
          "[data-path='http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/hasLogicalDataSet']",
        );

    expect(logicalDatasetInstances.length)
      .withContext('Should render both logical dataset instances')
      .toBe(2);

    form.remove();
  });
});
