import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TreeNode } from 'primeng/api';
import { MetadatafieldComponent } from './metadatafield.component';
import { Field, Fieldaction } from '../models/field';

describe('MetadatafieldComponent', () => {
  let component: MetadatafieldComponent;
  let fixture: ComponentFixture<MetadatafieldComponent>;

  const buildFieldTree = () => {
    const leafField: Field = {
      id: 'leaf1',
      name: 'Title',
      leafValue: 'My dataset',
      action: Fieldaction.Copy,
      field: {
        typeName: 'title',
        typeClass: 'primitive',
        multiple: false,
        value: 'My dataset',
        source: 'codemeta.json',
      },
    };

    const childNode: TreeNode<Field> = {
      key: 'leaf1',
      data: leafField,
      children: [],
    };

    const parentNode: TreeNode<Field> = {
      key: 'parent',
      data: {
        id: 'parent',
        name: 'Citation',
        action: Fieldaction.Ignore,
      },
      children: [childNode],
    };

    const map = new Map<string, TreeNode<Field>>();
    map.set('', parentNode);
    map.set('leaf1', childNode);

    return { parentNode, childNode, map };
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MetadatafieldComponent],
    })
      .overrideComponent(MetadatafieldComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MetadatafieldComponent);
    component = fixture.componentInstance;
  });

  it('computes host class and metadata helpers', () => {
    const { childNode, map } = buildFieldTree();
    fixture.componentRef.setInput('field', childNode.data);
    fixture.componentRef.setInput('rowNode', childNode);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.detectChanges();

    expect(component.hostClass).toContain('file-action-copy');
    expect(component.name()).toBe('Title');
    expect(component.value()).toBe('My dataset');
    expect(component.source()).toBe('codemeta.json');
    expect(component.action()).toBe(MetadatafieldComponent.icon_copy);
  });

  it('source falls back to first leaf child when parent lacks metadata', () => {
    const { parentNode, map } = buildFieldTree();
    parentNode.data = {
      id: 'parent',
      name: 'Compound',
      action: Fieldaction.Ignore,
    };
    fixture.componentRef.setInput('field', parentNode.data);
    fixture.componentRef.setInput('rowNode', parentNode);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.detectChanges();

  expect(component.node).toEqual(parentNode);
    component.node = parentNode;
    expect(parentNode.children?.length).toBe(1);
    const derived = (component as unknown as {
      firstLeafSource(node?: TreeNode<Field>): string | undefined;
    }).firstLeafSource(parentNode);
    expect(derived).toBe('codemeta.json');
    expect(component.source()).toBe('codemeta.json');
    expect(component.hostClass).toBe('');
  });

  it('toggleAction cascades updates and resolve folder state', () => {
    const { parentNode, childNode, map } = buildFieldTree();
    childNode.data!.action = Fieldaction.Ignore;
    parentNode.children!.push({
      key: 'leaf2',
      data: {
        id: 'leaf2',
        name: 'Description',
        leafValue: 'Desc',
        action: Fieldaction.Ignore,
        field: {
          typeName: 'description',
          typeClass: 'primitive',
          multiple: false,
          value: 'Desc',
        },
      },
      children: [],
    });

    fixture.componentRef.setInput('field', childNode.data);
    fixture.componentRef.setInput('rowNode', childNode);
    fixture.componentRef.setInput('rowNodeMap', map);
    fixture.detectChanges();

    component.toggleAction();
    expect(parentNode.children?.[0].data?.action).toBe(Fieldaction.Copy);
    expect(parentNode.data?.action).toBe(Fieldaction.Custom);

    const result = component.updateFolderActions(parentNode);
    expect(result).toBe(Fieldaction.Custom);
    expect(parentNode.data?.action).toBe(Fieldaction.Custom);
  });

  it('static toggleNodeAction cycles between ignore and copy and propagates', () => {
    const { parentNode } = buildFieldTree();
    MetadatafieldComponent.toggleNodeAction(parentNode);
    expect(parentNode.data?.action).toBe(Fieldaction.Copy);
    expect(parentNode.children?.[0].data?.action).toBe(Fieldaction.Copy);

    MetadatafieldComponent.toggleNodeAction(parentNode);
    expect(parentNode.data?.action).toBe(Fieldaction.Ignore);
    expect(parentNode.children?.[0].data?.action).toBe(Fieldaction.Ignore);
  });
});
