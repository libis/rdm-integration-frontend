// Focused spec to ensure logical datasets mirror physical datasets via blank nodes

import { Parser } from 'n3';

describe('Logical vs Physical Dataset Parity', () => {
  const SHACL_SHAPES = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:test:DatasetShape> a sh:NodeShape;
   sh:targetNode <http://example.com/dataset/demo>;
   sh:targetClass cdi:DataSet;
   sh:property [
     sh:path cdi:hasPhysicalDataSet;
     sh:name "Physical data sets";
     sh:minCount 1;
     sh:nodeKind sh:BlankNode;
     sh:node <urn:test:PhysicalDataSetShape>;
   ];
   sh:property [
     sh:path cdi:hasLogicalDataSet;
     sh:name "Logical data sets";
     sh:minCount 1;
     sh:nodeKind sh:BlankNode;
     sh:node <urn:test:LogicalDataSetShape>;
   ];
   sh:property [
     sh:path prov:wasGeneratedBy;
     sh:minCount 1;
     sh:nodeKind sh:BlankNode;
     sh:node <urn:test:ProcessStepShape>;
   ].

<urn:test:PhysicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:PhysicalDataSet;
   sh:property [
     sh:path dcterms:format;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:nodeKind sh:IRI;
     sh:minCount 0;
     sh:maxCount 1;
   ].

<urn:test:LogicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:LogicalDataSet;
   sh:property [
     sh:path dcterms:identifier;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:prefLabel;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:description;
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:containsVariable;
     sh:nodeKind sh:IRI;
     sh:minCount 1;
     sh:node <urn:test:VariableShape>;
   ].

<urn:test:VariableShape> a sh:NodeShape;
   sh:targetClass cdi:Variable;
   sh:property [
     sh:path dcterms:identifier;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:prefLabel;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasRepresentation;
     sh:nodeKind sh:IRI;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasRole;
     sh:nodeKind sh:IRI;
     sh:minCount 1;
     sh:maxCount 1;
   ].

<urn:test:ProcessStepShape> a sh:NodeShape;
   sh:targetClass cdi:ProcessStep;
   sh:property [
     sh:path dcterms:description;
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ].
`;

  const SAMPLE_DATA = `@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix ex: <http://example.com/> .

ex:dataset-demo a cdi:DataSet ;
    cdi:hasPhysicalDataSet [
        a cdi:PhysicalDataSet ;
        dcterms:format "text/csv" ;
        dcterms:identifier <http://example.com/file.csv>
    ] ;
    cdi:hasLogicalDataSet [
        a cdi:LogicalDataSet ;
        dcterms:identifier "logical-dataset-primary" ;
        skos:prefLabel "Logical dataset: primary" ;
        dcterms:description "Primary logical dataset" ;
        cdi:containsVariable ex:var-age
    ] ;
    cdi:hasLogicalDataSet [
        a cdi:LogicalDataSet ;
        dcterms:identifier "logical-dataset-secondary" ;
        skos:prefLabel "Logical dataset: secondary" ;
        dcterms:description "Secondary logical dataset" ;
        cdi:containsVariable ex:var-status
    ] ;
    prov:wasGeneratedBy [
        a cdi:ProcessStep ;
        dcterms:description "Generated CDI from CSV via streaming profiler"
    ].

ex:var-age a cdi:Variable ;
    dcterms:identifier "age" ;
    skos:prefLabel "age" ;
    cdi:hasRepresentation xsd:integer ;
    cdi:hasRole ex:role-age .

ex:var-status a cdi:Variable ;
    dcterms:identifier "status" ;
    skos:prefLabel "status" ;
    cdi:hasRepresentation xsd:boolean ;
    cdi:hasRole ex:role-status .

ex:role-age a cdi:Role ;
    skos:prefLabel "measure" .

ex:role-status a cdi:Role ;
    skos:prefLabel "dimension" .
`;

  const SH = 'http://www.w3.org/ns/shacl#';
  const CDI = 'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/';
  const PROV = 'http://www.w3.org/ns/prov#';
  const DCTERMS = 'http://purl.org/dc/terms/';

  const parse = (ttl: string) => new Parser().parse(ttl);

  it('enforces blank nodes for logical and physical datasets in the shapes', () => {
    const quads = parse(SHACL_SHAPES);

    const datasetShapeProperties = quads.filter(
      (quad) =>
        quad.subject.value === 'urn:test:DatasetShape' &&
        quad.predicate.value === `${SH}property`,
    );
    expect(datasetShapeProperties.length)
      .withContext('Dataset shape should define three properties')
      .toBe(3);

    const ensureBlankNodeNodeKind = (pathIri: string) => {
      const propertyNode = datasetShapeProperties.find((quad) => {
        const pathQuad = quads.find(
          (candidate) =>
            candidate.subject.value === quad.object.value &&
            candidate.predicate.value === `${SH}path` &&
            candidate.object.value === pathIri,
        );
        return Boolean(pathQuad);
      });

      expect(propertyNode)
        .withContext(`Expected sh:property for path ${pathIri}`)
        .toBeDefined();

      const nodeKind = quads.find(
        (candidate) =>
          candidate.subject.value === propertyNode?.object.value &&
          candidate.predicate.value === `${SH}nodeKind`,
      );
      expect(nodeKind?.object.value)
        .withContext(`Path ${pathIri} should require sh:BlankNode`)
        .toBe(`${SH}BlankNode`);
    };

    ensureBlankNodeNodeKind(`${CDI}hasPhysicalDataSet`);
    ensureBlankNodeNodeKind(`${CDI}hasLogicalDataSet`);
    ensureBlankNodeNodeKind(`${PROV}wasGeneratedBy`);
  });

  it('models logical datasets as blank nodes just like physical datasets', () => {
    const quads = parse(SAMPLE_DATA);
    const dataset = 'http://example.com/dataset-demo';

    const collectObjects = (predicateIri: string) =>
      quads.filter(
        (quad) =>
          quad.subject.value === dataset &&
          quad.predicate.value === predicateIri,
      );

    const physicalLinks = collectObjects(`${CDI}hasPhysicalDataSet`);
    const logicalLinks = collectObjects(`${CDI}hasLogicalDataSet`);

    expect(physicalLinks.length)
      .withContext('Dataset should link to at least one PhysicalDataSet')
      .toBeGreaterThan(0);
    expect(logicalLinks.length)
      .withContext('Dataset should link to multiple LogicalDataSets')
      .toBe(2);

    physicalLinks.forEach((quad) =>
      expect(quad.object.termType)
        .withContext('PhysicalDataSet link should use blank node')
        .toBe('BlankNode'),
    );

    logicalLinks.forEach((quad) =>
      expect(quad.object.termType)
        .withContext('LogicalDataSet link should use blank node')
        .toBe('BlankNode'),
    );

    const logicalSubjects = logicalLinks.map((quad) => quad.object.value);
    logicalSubjects.forEach((subject) => {
      const identifier = quads.find(
        (quad) =>
          quad.subject.value === subject &&
          quad.predicate.value === `${DCTERMS}identifier`,
      );
      const label = quads.find(
        (quad) =>
          quad.subject.value === subject &&
          quad.predicate.value ===
            'http://www.w3.org/2004/02/skos/core#prefLabel',
      );
      const typeTriple = quads.find(
        (quad) =>
          quad.subject.value === subject &&
          quad.predicate.value ===
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      );

      expect(typeTriple?.object.value)
        .withContext('LogicalDataSet blank node should be typed correctly')
        .toBe(`${CDI}LogicalDataSet`);
      expect(identifier)
        .withContext('LogicalDataSet should retain identifier literal')
        .toBeDefined();
      expect(label)
        .withContext('LogicalDataSet should retain prefLabel literal')
        .toBeDefined();
    });
  });
});
