import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, withDisabledInitialNavigation } from '@angular/router';
import { ConnectComponent } from '../connect/connect.component';
import { DownloadComponent } from '../download/download.component';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import { Config, RepoPlugin } from '../models/plugin';
import { PluginService } from '../plugin.service';

type Picker = ConnectComponent | DownloadComponent;

const globus: RepoPlugin = {
  id: 'globus',
  plugin: 'globus',
  name: 'Globus',
  pluginName: 'Globus',
  repoNameFieldName: 'Endpoint',
  repoNameFieldHasSearch: false,
  repoNameFieldHasInit: false,
  parseSourceUrlField: false,
  sourceUrlFieldValue: 'https://transfer.example',
  optionFieldName: 'Folder',
  optionFieldInteractive: true,
};

// Exercise the real application templates and folder tree bindings. Most
// component unit tests replace these templates, hiding migration regressions.
for (const scenario of [
  { name: 'connect', type: ConnectComponent as Type<Picker> },
  { name: 'download', type: DownloadComponent as Type<Picker> },
]) {
  describe(`${scenario.name} Globus picker with rendered components`, () => {
    let fixture: ComponentFixture<Picker>;
    let http: HttpTestingController;

    beforeEach(async () => {
      // Authentication and route restoration have separate coverage. Seed
      // their resulting state here, keeping the production template intact.
      spyOn(scenario.type.prototype, 'ngOnInit').and.resolveTo();
      await TestBed.configureTestingModule({
        imports: [scenario.type],
        providers: [
          provideRouter([], withDisabledInitialNavigation()),
          provideHttpClient(withXhr()),
          provideHttpClientTesting(),
        ],
      }).compileComponents();
      http = TestBed.inject(HttpTestingController);
      const ready = TestBed.inject(PluginService).setConfig();
      const config: Config = {
        dataverseHeader: 'Dataverse',
        collectionOptionsHidden: true,
        createNewDatasetEnabled: false,
        datasetFieldEditable: false,
        collectionFieldEditable: false,
        externalURL: 'https://dataverse.example',
        showDvTokenGetter: false,
        showDvToken: false,
        redirect_uri: '',
        sendMails: false,
        plugins: [globus],
      };
      http.expectOne('api/frontend/config').flush(config);
      await ready;
      fixture = TestBed.createComponent(scenario.type);
      const comp = fixture.componentInstance;
      comp.token.set('test-session');
      if (comp instanceof ConnectComponent) {
        comp.plugin.set('globus');
        comp.pluginId.set('globus');
        comp.repoName.set('ep');
      } else {
        comp.globusPlugin.set(globus);
        comp.selectedRepoName.set('ep');
        comp.datasetId.set('doi:1/TEST');
        comp.data.set({ id: 'doi:1/TEST', data: [] });
      }
      fixture.detectChanges();
      await fixture.whenStable();
    });

    afterEach(() => http.verify());

    function element(selector: string): HTMLElement {
      const found = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLElement>(selector);
      expect(found).withContext(selector).not.toBeNull();
      return found!;
    }

    function labels(): string[] {
      return Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          '.folder-label',
        ),
        (node) => node.textContent!.trim(),
      );
    }

    async function answer(
      option: string,
      items: HierarchicalSelectItem<string>[],
    ): Promise<void> {
      const req = http.expectOne('api/plugin/options');
      expect(req.request.body.option).toBe(option);
      expect(req.request.body.repoName).toBe('ep');
      req.flush(items);
      await fixture.whenStable();
    }

    for (const home of ['/home/alice/', '/Users/alice/', '/C/Users/alice/']) {
      it(`renders and selects ${home}, then browses and selects the root`, async () => {
        element('.folder-toggle').click();
        let items: HierarchicalSelectItem<string>[] = [
          { label: 'Documents', value: `${home}Documents/` },
        ];
        const segments = home.split('/').filter(Boolean);
        for (let i = segments.length - 1; i >= 0; i--) {
          items = [
            {
              label: segments[i],
              value: `/${segments.slice(0, i + 1).join('/')}/`,
              selected: i === segments.length - 1,
              expanded: true,
              children: items,
            },
          ];
        }
        await answer('', [
          { label: '/', value: '/', expanded: true, children: items },
        ]);
        expect(labels()).toEqual(['/', ...segments, 'Documents']);
        expect(fixture.componentInstance.option()).toBe(home);
        expect(element('.folder-node.selected .folder-label').textContent).toBe(
          'alice',
        );
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          `Selected: ${home}`,
        );

        // Collapse/reopen '/' to load folders outside the initial home branch.
        element('.folder-toggle').click();
        await fixture.whenStable();
        element('.folder-toggle').click();
        await answer('/', [{ label: 'shared', value: '/shared/' }]);
        expect(labels()).toEqual(['/', 'shared']);
        element('.folder-label').click();
        await fixture.whenStable();
        expect(fixture.componentInstance.option()).toBe('/');
        expect(element('.folder-node.selected .folder-label').textContent).toBe(
          '/',
        );

        element('.folder-toggle').click();
        await fixture.whenStable();
        element('.folder-toggle').click();
        await answer('/', [{ label: 'shared', value: '/shared/' }]);
        expect(fixture.componentInstance.option()).toBe('/');
        expect(
          (fixture.nativeElement as HTMLElement).querySelector(
            '.folder-node.selected',
          ),
        )
          .withContext('selection must survive a lazy listing refresh')
          .not.toBeNull();

        element('.folder-label').click();
        await fixture.whenStable();
        expect(fixture.componentInstance.option())
          .withContext('unselecting must clear the transfer path')
          .toBeUndefined();
      });
    }

    function selectedNode(): HTMLElement | null {
      return (fixture.nativeElement as HTMLElement).querySelector(
        '.folder-node.selected',
      );
    }

    it('renders a public root without a home and never selects it by itself', async () => {
      element('.folder-toggle').click();
      await answer('', [
        {
          label: '/',
          value: '/',
          expanded: true,
          children: [{ label: 'pub', value: '/pub/' }],
        },
      ]);
      expect(labels()).toEqual(['/', 'pub']);
      expect(fixture.componentInstance.option()).toBeUndefined();
      expect(selectedNode()).toBeNull();
      expect(fixture.componentInstance.optionsLoading()).toBeFalse();
      element('.folder-label').click();
      await fixture.whenStable();
      expect(fixture.componentInstance.option()).toBe('/');
      expect(element('.folder-node.selected .folder-label').textContent).toBe(
        '/',
      );
    });

    it('keeps object storage shaped paths verbatim through selection, browsing and an empty listing', async () => {
      element('.folder-toggle').click();
      await answer('', [
        {
          label: '/',
          value: '/',
          expanded: true,
          children: [
            {
              label: 'bucket',
              value: '/bucket/',
              expanded: true,
              children: [
                {
                  label: 'project',
                  value: '/bucket/project/',
                  selected: true,
                  expanded: true,
                  children: [{ label: 'data', value: '/bucket/project/data/' }],
                },
              ],
            },
          ],
        },
      ]);
      expect(labels()).toEqual(['/', 'bucket', 'project', 'data']);
      expect(fixture.componentInstance.option()).toBe('/bucket/project/');
      const toggles = () =>
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
          '.folder-toggle',
        );
      toggles()[3].click();
      await answer('/bucket/project/data/', []);
      expect(labels()).toEqual(['/', 'bucket', 'project', 'data']);
      expect(fixture.componentInstance.option()).toBe('/bucket/project/');
      expect(fixture.componentInstance.optionsLoading()).toBeFalse();
      const dataLabels = (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLElement>('.folder-label');
      dataLabels[3].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.option()).toBe('/bucket/project/data/');
      expect(element('.folder-node.selected .folder-label').textContent).toBe(
        'data',
      );
    });

    it('browses to another Windows drive from a resolved home', async () => {
      element('.folder-toggle').click();
      await answer('', [
        {
          label: '/',
          value: '/',
          expanded: true,
          children: [
            {
              label: 'C',
              value: '/C/',
              expanded: true,
              children: [
                {
                  label: 'Users',
                  value: '/C/Users/',
                  expanded: true,
                  children: [
                    {
                      label: 'alice',
                      value: '/C/Users/alice/',
                      selected: true,
                      expanded: true,
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]);
      expect(fixture.componentInstance.option()).toBe('/C/Users/alice/');
      element('.folder-toggle').click();
      await fixture.whenStable();
      element('.folder-toggle').click();
      await answer('/', [
        { label: 'C', value: '/C/' },
        { label: 'D', value: '/D/' },
      ]);
      expect(labels()).toEqual(['/', 'C', 'D']);
      expect(fixture.componentInstance.option())
        .withContext('a lazy root reload must not change the selection')
        .toBe('/C/Users/alice/');
      const drives = (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLElement>('.folder-label');
      drives[2].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.option()).toBe('/D/');
      expect(element('.folder-node.selected .folder-label').textContent).toBe(
        'D',
      );
    });

    it('stops loading and selects nothing when the listing is empty or fails', async () => {
      element('.folder-toggle').click();
      await answer('', []);
      expect(fixture.componentInstance.optionsLoading()).toBeFalse();
      expect(fixture.componentInstance.option()).toBeUndefined();
      expect(selectedNode()).toBeNull();
      element('.folder-toggle').click();
      await fixture.whenStable();
      element('.folder-toggle').click();
      const req = http.expectOne('api/plugin/options');
      expect(req.request.body.option).toBe('');
      req.flush('restricted', { status: 403, statusText: 'Forbidden' });
      await fixture.whenStable();
      expect(fixture.componentInstance.optionsLoading()).toBeFalse();
      expect(fixture.componentInstance.option()).toBeUndefined();
      expect(selectedNode()).toBeNull();
    });

    it('keeps an unresolved home unselected and expands the separate root', async () => {
      element('.folder-toggle').click();
      await answer('', [
        { label: '/', value: '/' },
        {
          label: '~',
          value: '/~/',
          expanded: true,
          children: [{ label: 'data', value: '/~/data/' }],
        },
      ]);
      expect(labels()).toEqual(['/', '~', 'data']);
      expect(fixture.componentInstance.option()).toBeUndefined();
      element('.folder-toggle').click();
      await answer('/', [{ label: 'zone', value: '/zone/' }]);
      expect(labels()).toEqual(['/', 'zone', '~', 'data']);
      expect(fixture.componentInstance.option()).toBeUndefined();
    });
  });
}
