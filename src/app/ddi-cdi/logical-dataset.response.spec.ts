import '../shacl-form-patch';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const datasetTurtle = `@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://example.org/dataset/2> a cdi:DataSet ;
  dcterms:identifier "doi:10.5072/FK2/HWBVZM" ;
  cdi:hasLogicalDataSet [ a cdi:LogicalDataSet ;
      cdi:containsVariable <http://example.org/dataset/2#var/col_1>,
        <http://example.org/dataset/2#var/col_2>,
        <http://example.org/dataset/2#var/col_3> ],
    [ a cdi:LogicalDataSet ;
      cdi:containsVariable <http://example.org/dataset/2#var/id>,
        <http://example.org/dataset/2#var/name> ],
    [ a cdi:LogicalDataSet ;
      cdi:containsVariable <http://example.org/dataset/2#var/date_col> ],
    [ a cdi:LogicalDataSet ;
      cdi:containsVariable <http://example.org/dataset/2#var/float_col> ] ;
  cdi:hasPhysicalDataSet [ a cdi:PhysicalDataSet ;
      dcterms:format "text/csv" ;
      dcterms:identifier <http://example.org/file/1> ] ;
  prov:wasGeneratedBy [ a prov:Activity ].

<http://example.org/dataset/2#var/col_1> a cdi:Variable ;
  dcterms:identifier "col_1" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/2#role/col_1> ;
  skos:prefLabel "col_1" .

<http://example.org/dataset/2#var/col_2> a cdi:Variable ;
  dcterms:identifier "col_2" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/2#role/col_2> ;
  skos:prefLabel "col_2" .

<http://example.org/dataset/2#var/col_3> a cdi:Variable ;
  dcterms:identifier "col_3" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/2#role/col_3> ;
  skos:prefLabel "col_3" .

<http://example.org/dataset/2#var/id> a cdi:Variable ;
  dcterms:identifier "id" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/2#role/id> ;
  skos:prefLabel "id" .

<http://example.org/dataset/2#var/name> a cdi:Variable ;
  dcterms:identifier "name" ;
  cdi:hasRepresentation xsd:string ;
  cdi:hasRole <http://example.org/dataset/2#role/name> ;
  skos:prefLabel "name" .

<http://example.org/dataset/2#var/date_col> a cdi:Variable ;
  dcterms:identifier "date_col" ;
  cdi:hasRepresentation xsd:dateTime ;
  cdi:hasRole <http://example.org/dataset/2#role/date_col> ;
  skos:prefLabel "date_col" .

<http://example.org/dataset/2#var/float_col> a cdi:Variable ;
  dcterms:identifier "float_col" ;
  cdi:hasRepresentation xsd:float ;
  cdi:hasRole <http://example.org/dataset/2#role/float_col> ;
  skos:prefLabel "float_col" .

<http://example.org/dataset/2#role/col_1> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/col_2> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/col_3> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/id> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/name> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/date_col> a cdi:Role ; skos:prefLabel "attribute" .
<http://example.org/dataset/2#role/float_col> a cdi:Role ; skos:prefLabel "attribute" .
`;

const shapesTurtle = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:test:DatasetShape> a sh:NodeShape ;
  sh:targetNode <http://example.org/dataset/2> ;
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
    sh:minCount 1 ;
    sh:nodeKind sh:BlankNode ;
    sh:class cdi:LogicalDataSet ;
    sh:node <urn:test:LogicalDataSetShape> ;
  ] ;
  sh:property [
    sh:path cdi:hasPhysicalDataSet ;
    sh:minCount 0 ;
    sh:nodeKind sh:BlankNode ;
    sh:node <urn:test:PhysicalDataSetShape> ;
  ] ;
  sh:property [
    sh:path prov:wasGeneratedBy ;
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

describe('shacl-form response fixture coverage', () => {
  it('retains all logical dataset blank nodes from response-style Turtle', async () => {
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
    form.setAttribute('data-values-subject', 'http://example.org/dataset/2');
    form.setAttribute('data-shape-subject', 'urn:test:DatasetShape');

    form.dataShapes = shapesTurtle;
    form.dataShapesFormat = 'text/turtle';
    form.dataValues = datasetTurtle;
    form.dataValuesFormat = 'text/turtle';
    form.dataValuesSubject = 'http://example.org/dataset/2';
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
      .withContext('Should render every logical dataset instance from response graph')
      .toBe(4);

    form.remove();
  });
});
