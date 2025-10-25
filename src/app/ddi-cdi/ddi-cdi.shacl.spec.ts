// Test to reproduce LogicalDataSet SHACL form rendering issue
/* eslint-disable no-console */

import { Parser } from 'n3';

describe('DDI-CDI SHACL Shape Tests', () => {
  const sampleRdfTurtle = `@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<http://localhost:8080/dataset/doi:10.5072/FK2/TEST> a cdi:DataSet ;
    dcterms:identifier "doi:10.5072/FK2/TEST" ;
    dcterms:title "Test Dataset" ;
    cdi:hasLogicalDataSet <http://localhost:8080/dataset/doi:10.5072/FK2/TEST#logical/logical_sample_tab>,
        <http://localhost:8080/dataset/doi:10.5072/FK2/TEST#logical/logical_simple_data_dct> .

<http://localhost:8080/dataset/doi:10.5072/FK2/TEST#logical/logical_sample_tab> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: sample.tab""" ;
    dcterms:identifier "logical-dataset-logical_sample_tab" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/TEST#var/col_1> ;
    skos:prefLabel "Logical dataset: sample.tab" .

<http://localhost:8080/dataset/doi:10.5072/FK2/TEST#logical/logical_simple_data_dct> a cdi:LogicalDataSet ;
    dcterms:description """Test

Logical representation of data from file: simple_data.dct""" ;
    dcterms:identifier "logical-dataset-logical_simple_data_dct" ;
    cdi:containsVariable <http://localhost:8080/dataset/doi:10.5072/FK2/TEST#var/col_1> ;
    skos:prefLabel "Logical dataset: simple_data.dct" .

<http://localhost:8080/dataset/doi:10.5072/FK2/TEST#var/col_1> a cdi:Variable ;
    dcterms:identifier "col_1" ;
    cdi:hasRepresentation xsd:string ;
    cdi:hasRole <http://localhost:8080/dataset/doi:10.5072/FK2/TEST#role/col_1> ;
    skos:prefLabel "col_1" .

<http://localhost:8080/dataset/doi:10.5072/FK2/TEST#role/col_1> a cdi:Role ;
    skos:prefLabel "attribute" .
`;

  const shaclShapesTemplate = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:ddi-cdi:DatasetShape> a sh:NodeShape;
   sh:targetNode <http://localhost:8080/dataset/doi:10.5072/FK2/TEST>;
   sh:targetClass cdi:DataSet;
   sh:class cdi:DataSet;
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Dataset identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasLogicalDataSet;
     sh:name "Logical data sets";
     sh:minCount 1;
     sh:nodeKind sh:BlankNodeOrIRI;
     sh:class cdi:LogicalDataSet;
     sh:node <urn:ddi-cdi:LogicalDataSetShape>;
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
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Variable identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasRepresentation;
     sh:name "Variable datatype";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
   ];
   sh:property [
     sh:path cdi:hasRole;
     sh:name "Variable role";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
     sh:node <urn:ddi-cdi:RoleShape>;
   ].

<urn:ddi-cdi:RoleShape> a sh:NodeShape;
   sh:targetClass cdi:Role;
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Role label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:maxCount 1;
   ].
`;

  it('should parse RDF Turtle with multiple LogicalDataSets', () => {
    const parser = new Parser();
    const quads = parser.parse(sampleRdfTurtle);

    expect(quads.length).toBeGreaterThan(0);

    // Find all LogicalDataSet subjects
    const logicalDataSets = quads.filter(
      (q) =>
        q.predicate.value ===
          'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
        q.object.value ===
          'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/LogicalDataSet'
    );

    expect(logicalDataSets.length).toBe(2);
    console.log(
      'Found LogicalDataSets:',
      logicalDataSets.map((q) => q.subject.value)
    );
  });

  it('should verify each LogicalDataSet has required properties', () => {
    const parser = new Parser();
    const quads = parser.parse(sampleRdfTurtle);

    // Find LogicalDataSet URIs
    const logicalDataSetUris = quads
      .filter(
        (q) =>
          q.predicate.value ===
            'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' &&
          q.object.value ===
            'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/LogicalDataSet'
      )
      .map((q) => q.subject.value);

    logicalDataSetUris.forEach((uri) => {
      console.log(`\nChecking LogicalDataSet: ${uri}`);

      // Check for dcterms:identifier
      const identifiers = quads.filter(
        (q) =>
          q.subject.value === uri &&
          q.predicate.value === 'http://purl.org/dc/terms/identifier'
      );
      console.log(
        `  dcterms:identifier: ${identifiers.map((q) => q.object.value)}`
      );
      expect(identifiers.length).withContext(`${uri} should have exactly one dcterms:identifier`).toBe(1);

      // Check for skos:prefLabel
      const labels = quads.filter(
        (q) =>
          q.subject.value === uri &&
          q.predicate.value === 'http://www.w3.org/2004/02/skos/core#prefLabel'
      );
      console.log(`  skos:prefLabel: ${labels.map((q) => q.object.value)}`);
      expect(labels.length).withContext(`${uri} should have exactly one skos:prefLabel`).toBe(1);

      // Check for dcterms:description
      const descriptions = quads.filter(
        (q) =>
          q.subject.value === uri &&
          q.predicate.value === 'http://purl.org/dc/terms/description'
      );
      console.log(
        `  dcterms:description: ${descriptions.map((q) => q.object.value)}`
      );
      expect(descriptions.length).withContext(`${uri} should have exactly one dcterms:description`).toBe(1);

      // Check for cdi:containsVariable
      const variables = quads.filter(
        (q) =>
          q.subject.value === uri &&
          q.predicate.value ===
            'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/containsVariable'
      );
      console.log(
        `  cdi:containsVariable: ${variables.map((q) => q.object.value)}`
      );
      expect(variables.length).withContext(`${uri} should have at least one cdi:containsVariable`).toBeGreaterThan(0);
    });
  });

  it('should parse SHACL shapes and verify LogicalDataSet shape properties', () => {
    const parser = new Parser();
    const shapeQuads = parser.parse(shaclShapesTemplate);

    expect(shapeQuads.length).toBeGreaterThan(0);

    // Find LogicalDataSetShape
    const logicalDataSetShapeTriples = shapeQuads.filter(
      (q) =>
        q.subject.value === 'urn:ddi-cdi:LogicalDataSetShape' &&
        q.predicate.value === 'http://www.w3.org/ns/shacl#property'
    );

    console.log(
      `\nLogicalDataSetShape has ${logicalDataSetShapeTriples.length} sh:property definitions`
    );

    // For each property, we need to follow the blank node to see what sh:path it defines
    const propertyPaths: string[] = [];
    logicalDataSetShapeTriples.forEach((triple) => {
      const blankNodeId = triple.object.value;
      const pathTriple = shapeQuads.find(
        (q) =>
          q.subject.value === blankNodeId &&
          q.predicate.value === 'http://www.w3.org/ns/shacl#path'
      );
      if (pathTriple) {
        propertyPaths.push(pathTriple.object.value);
        console.log(`  Found property path: ${pathTriple.object.value}`);
      }
    });

    // Verify the critical properties are defined
    expect(propertyPaths)
      .withContext('LogicalDataSetShape should define dcterms:identifier property')
      .toContain('http://purl.org/dc/terms/identifier');
    expect(propertyPaths)
      .withContext('LogicalDataSetShape should define skos:prefLabel property')
      .toContain('http://www.w3.org/2004/02/skos/core#prefLabel');
    expect(propertyPaths)
      .withContext('LogicalDataSetShape should define dcterms:description property')
      .toContain('http://purl.org/dc/terms/description');
    expect(propertyPaths)
      .withContext('LogicalDataSetShape should define cdi:containsVariable property')
      .toContain(
        'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/containsVariable'
      );
  });

  it('should demonstrate the issue: SHACL form needs shape properties to render fields', () => {
    console.log('\n=== ISSUE DEMONSTRATION ===');
    console.log('The SHACL form component requires sh:property definitions in the shape');
    console.log('to know which fields to render in the form.');
    console.log('');
    console.log('Without these properties in LogicalDataSetShape:');
    console.log('  - dcterms:identifier');
    console.log('  - skos:prefLabel');
    console.log('  - dcterms:description');
    console.log('');
    console.log('The form will appear EMPTY even though the RDF data contains these values.');
    console.log('');
    console.log('This is because the SHACL form uses the shape definitions to determine:');
    console.log('  1. Which properties to display as form fields');
    console.log('  2. The field labels (from sh:name)');
    console.log('  3. Validation rules (from sh:minCount, sh:maxCount, etc.)');
    console.log('  4. Data types (from sh:datatype)');
    console.log('');
    console.log('Solution: Add all three properties to LogicalDataSetShape in the SHACL template.');
  });
});
