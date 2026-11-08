import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import StructuredField from '../components/StructuredField.vue';
import AppLayout from '../layouts/AppLayout.vue';
import ProjectConnections from './ProjectConnections.vue';
import ProjectIdeas from './ProjectIdeas.vue';
import ProjectNarrative from './ProjectNarrative.vue';
import ProjectTimeline from './ProjectTimeline.vue';
import ProjectDetailsView from './ProjectDetailsView.vue';
import { contentRequest } from '../services/contentRecovery';
import { getContentTemplates } from '../services/contentTemplate';

export default {
    components: { AppLayout, ProjectDetailsView, StructuredField, ProjectTimeline, ProjectConnections, ProjectIdeas, ProjectNarrative },
    props: { projectId: { type: String, default: '' } },
    setup(props) {
        const folders = ref([]);
        const treeContents = ref([]);
        const settings = ref(false);
        const timeline = ref(false);
        const connections = ref(false);
        const ideas = ref(false);
        const narration = ref(false);
        const sidebarItems = computed(() => {
            const items = [];
            const visit = (parent, depth) => {
                for (const folder of folders.value.filter(item => item.parent_id === parent)) {
                    items.push({ key: 'folder-' + folder.id, folder, depth });
                    visit(folder.id, depth + 1);
                }
                for (const content of treeContents.value.filter(item => item.folder_id === parent)) {
                    items.push({ key: content.public_id + ':' + parent, content, depth });
                }
            };
            visit(null, 0);
            return items;
        });
        const folderId = ref(0);
        const folderName = ref('');
        const folderParent = ref(0);
        const folderEditing = ref(false);
        const placement = ref(0);
        const memberships = computed(() => treeContents.value
            .filter(item => item.public_id === selected.value?.public_id && item.folder_id !== null)
            .map(item => item.folder_id));
        const folderOptions = computed(() => {
            const branches = new Map();
            for (const folder of folders.value) {
                const parent = folder.parent_id ?? 0;
                if (!branches.has(parent)) branches.set(parent, []);
                branches.get(parent).push(folder);
            }
            const result = [];
            const visit = (parent, prefix) => {
                for (const folder of branches.get(parent) ?? []) {
                    const label = prefix + folder.name;
                    result.push({ ...folder, label });
                    visit(folder.id, label + ' / ');
                }
            };
            visit(0, '');
            return result;
        });
        const folderPath = () => '/projects/' + props.projectId + '/folders';

        const listing = ref(null);
        const catalogueSearch = ref('');
        const catalogueType = ref('');
        const catalogueStatus = ref('');
        const searchWholeProject = ref(false);
        const appliedCatalogueFilters = ref({});
        const trash = ref(!props.projectId);
        const projectTrash = ref(!props.projectId);
        const projects = ref([]);
        const projectId = ref(props.projectId);
        const currentProject = computed(() => projects.value.find(project => String(project.id) === props.projectId));
        const types = ref([]);
        const newTitle = ref('');
        const typeId = ref('');
        const templates = ref([]);
        const versionId = ref('');
        const upgradeVersions = ref([]);
        const upgradeVersionId = ref('');
        const upgradePreview = ref(null);
        const versions = ref([]);
        const templateId = ref('');
        const templateOptions = computed(() => templates.value.filter(template =>
            template.content_type_id === typeId.value && (template.scope_type === 'global'
                || (template.scope_type === 'project' && String(template.project_id) === props.projectId))
        ));

        watch(typeId, async id => {
            templateId.value = '';
            if (!id || templates.value.length) return;
            try {
                templates.value = await getContentTemplates();
            } catch (failure) {
                error.value = failure.message;
            }
        });

        watch(templateId, async id => {
            versions.value = [];
            versionId.value = '';
            if (!id) return;
            try {
                const { data } = await contentRequest('/content-templates/' + id);
                if (templateId.value !== id) return;
                versions.value = data.versions;
                versionId.value = data.versions.at(-1)?.id ?? '';
            } catch (failure) {
                error.value = failure.message;
            }
        });
        const selected = ref(null);
        const draft = ref(null);
        const baseline = ref('');
        const version = ref('');
        const revisions = ref(null);
        const from = ref('');
        const to = ref('');
        const comparison = ref(null);
        const snapshotName = ref('');
        const snapshotNote = ref('');
        const error = ref('');
        const busy = ref(false);
        const saving = ref(false);
        const dirty = computed(() => draft.value !== null && JSON.stringify(draft.value) !== baseline.value);
        let timer;

        const path = () => '/contents/' + selected.value.public_id;
        const draftKey = () => 'bifrost:draft:' + selected.value.public_id;

        const fieldColumns = {
            text: 'value_text', choice: 'value_text', number: 'value_number',
            boolean: 'value_boolean', date: 'value_date', json: 'value_json',
        };
        const templateSections = computed(() => {
            const sections = new Map();
            for (const field of selected.value?.template_assignment?.template_version?.fields ?? []) {
                const column = fieldColumns[field.field_definition?.value_type];
                const format = field.field_definition?.options_data?.format;
                if (!column || (column === 'value_json' && !['measurement', 'coordinates', 'temporal', 'references'].includes(format))) continue;
                const section = field.display_options?.section_label ?? field.section_key ?? 'Informations';
                if (!sections.has(section)) sections.set(section, []);
                sections.get(section).push({ ...field, column, format });
            }
            return sections;
        });
        const fieldValue = field => draft.value.field_values?.find(value =>
            value.field_definition_id === field.field_definition_id
        )?.[field.column] ?? '';
        function setField(field, value) {
            const values = draft.value.field_values ??= [];
            const index = values.findIndex(item => item.field_definition_id === field.field_definition_id);
            if (value === '') {
                if (index >= 0) values.splice(index, 1);
                return;
            }

            const entry = {
                field_definition_id: field.field_definition_id,
                [field.column]: field.column === 'value_boolean' ? value === 'true' : value,
            };
            if (index >= 0) values.splice(index, 1, entry);
            else values.push(entry);
        }

        function accept(data, token) {
            selected.value = data;
            const editable = {
                title: data.title,
                summary: data.summary,
                ...(data.work_status_key ? { work_status_key: data.work_status_key } : {}),
                blocks: data.blocks.map(({ public_id, block_type, title, body }) => ({
                    public_id, block_type, title, body,
                })),
            };
            if (templateSections.value.size) {
                editable.field_values = (data.field_values ?? []).map(({ id, content_id, created_at, updated_at, ...value }) => ({
                    ...value,
                    ...(value.value_date ? { value_date: value.value_date.slice(0, 10) } : {}),
                }));
            }
            baseline.value = JSON.stringify(editable);
            version.value = token;
            draft.value = editable;
        }

        async function run(action) {
            if (busy.value || saving.value) return;
            busy.value = true;
            error.value = '';
            try {
                await action();
            } catch (failure) {
                error.value = failure.message;
            } finally {
                busy.value = false;
            }
        }

        async function loadList(page = 1) {
            const params = new URLSearchParams({ page });
            if (props.projectId) {
                params.set('project_id', props.projectId);
                if (!trash.value) {
                    const filters = appliedCatalogueFilters.value;
                    if (!filters.wholeProject) params.set('folder_id', folderId.value);
                    for (const key of ['search', 'type', 'status']) {
                        if (filters[key]) params.set(key, filters[key]);
                    }
                }
            }
            const endpoint = projectTrash.value ? '/projects/trash' : trash.value ? '/contents/trash' : '/contents';
            const { data } = await contentRequest(endpoint + '?' + params);
            listing.value = data;
            if (props.projectId) {
                treeContents.value = (await contentRequest('/projects/' + props.projectId + '/tree')).data;
            }
        }

        async function loadFolders() {
            folders.value = (await contentRequest(folderPath())).data;
        }

        function selectFolder(id) {
            folderId.value = id;
            searchWholeProject.value = false;
            appliedCatalogueFilters.value = { ...appliedCatalogueFilters.value, wholeProject: false };
            folderParent.value = id;
            folderEditing.value = false;
            folderName.value = '';
        }

        async function loadHistory(page = 1) {
            revisions.value = (await contentRequest(path() + '/revisions?page=' + page)).data;
        }

        async function open(id) {
            placement.value = 0;
            const response = await contentRequest('/contents/' + id);
            accept(response.data, response.version);
            from.value = '';
            to.value = '';
            comparison.value = null;
            upgradeVersions.value = [];
            upgradeVersionId.value = '';
            upgradePreview.value = null;
            const saved = localStorage.getItem(draftKey());
            if (saved) {
                const recovered = JSON.parse(saved);
                if (window.confirm('Un brouillon local est disponible. Veux-tu le reprendre ?')) {
                    version.value = recovered.version;
                    draft.value = recovered.draft;
                } else {
                    localStorage.removeItem(draftKey());
                }
            }
            await loadHistory();
        }

        async function save() {
            if (!dirty.value || saving.value || busy.value) return;
            clearTimeout(timer);
            saving.value = true;
            error.value = '';
            try {
                const response = await contentRequest(path(), 'PATCH', { ...draft.value, version: version.value });
                accept(response.data, response.version);
                localStorage.removeItem(draftKey());
                await Promise.all([loadHistory(), loadList(listing.value?.current_page)]);
            } catch (failure) {
                error.value = failure.message;
            } finally {
                saving.value = false;
            }
        }

        watch(draft, () => {
            clearTimeout(timer);
            if (!dirty.value) return;
            try {
                localStorage.setItem(draftKey(), JSON.stringify({ version: version.value, draft: draft.value }));
            } catch {
                error.value = 'Le navigateur ne peut pas conserver le brouillon local.';
            }
            timer = setTimeout(save, 1000);
        }, { deep: true });

        function preventLeave(event) {
            if (dirty.value || saving.value) event.preventDefault();
        }

        onBeforeRouteLeave(() => !dirty.value && !saving.value || window.confirm('Quitter avec des modifications non enregistrées ?'));
        onMounted(() => {
            window.addEventListener('beforeunload', preventLeave);
            run(async () => {
                await loadList();
                if (props.projectId) await loadFolders();
                if (!props.projectId) return;
                projects.value = (await contentRequest('/projects')).data;
                const { data } = await contentRequest('/content-types');
                types.value = data.filter(type => ['system', 'global'].includes(type.scope_type));
            });
        });
        onUnmounted(() => {
            clearTimeout(timer);
            window.removeEventListener('beforeunload', preventLeave);
        });

        return {
            referenceTargets: computed(() => [...new Map(treeContents.value.map(item => [item.public_id, item])).values()]
                .filter(item => item.public_id !== selected.value?.public_id)),
            sidebarItems, settings, templateSections, fieldValue, setField, templateId, templateOptions, versions, versionId,
            upgradeVersions, upgradeVersionId, upgradePreview,
            loadUpgradeVersions: () => run(async () => {
                const assignment = selected.value.template_assignment;
                const { data } = await contentRequest('/content-templates/' + assignment.template_id);
                upgradeVersions.value = data.versions.filter(version => version.id !== assignment.template_version_id);
                upgradeVersionId.value = '';
                upgradePreview.value = null;
            }),
            previewUpgrade: () => run(async () => {
                upgradePreview.value = (await contentRequest(path() + '/template-versions/' + upgradeVersionId.value + '/preview')).data;
            }),
            applyUpgrade: () => run(async () => {
                if (!upgradePreview.value || dirty.value) return;
                await contentRequest(path() + '/template-versions/' + upgradePreview.value.to_version_id + '/apply', 'POST', {
                    from_version_id: upgradePreview.value.from_version_id,
                });
                await open(selected.value.public_id);
            }),
            timeline, connections, ideas, narration,
            openNarration: () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir la narration ?')) return;
                selected.value = null;
                draft.value = null;
                settings.value = false;
                timeline.value = false;
                connections.value = false;
                narration.value = false;
                ideas.value = false;
                narration.value = true;
            },
            openIdeas: () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir les idées ?')) return;
                selected.value = null;
                draft.value = null;
                settings.value = false;
                timeline.value = false;
                connections.value = false;
                narration.value = false;
                ideas.value = true;
            },
            openConnections: () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir les connexions ?')) return;

                narration.value = false;
                ideas.value = false;
                                selected.value = null;
                draft.value = null;
                settings.value = false;
                connections.value = false;
                timeline.value = false;
                connections.value = true;
            },
            openTimeline: () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir la chronologie ?')) return;

                narration.value = false;
                ideas.value = false;
                                selected.value = null;
                draft.value = null;
                settings.value = false;
                connections.value = false;
                timeline.value = true;
            },
            openTimelineContent: id => run(async () => {
                
                narration.value = false;
                ideas.value = false;
                connections.value = false;
                timeline.value = false;
                trash.value = false;
                await loadList();
                await open(id);
            }),
            openSettings: () => {
                
                narration.value = false;
                ideas.value = false;
                connections.value = false;
                timeline.value = false;
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir les paramètres ?')) return;
                selected.value = null;
                draft.value = null;
                settings.value = true;
            },
            openProjectTrash: () => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir la corbeille ?')) return;

                narration.value = false;
                ideas.value = false;
                                settings.value = false;
                selected.value = null;
                draft.value = null;
                connections.value = false;
                timeline.value = false;
                trash.value = true;
                await loadList();
            }),
            openTreeItem: item => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir cet élément ?')) return;

                narration.value = false;
                ideas.value = false;
                                settings.value = false;
                selected.value = null;
                draft.value = null;
                connections.value = false;
                timeline.value = false;
                trash.value = false;
                selectFolder(item.folder?.id ?? item.content?.folder_id ?? 0);
                await loadList();
                if (item.content) await open(item.content.public_id);
            }),
            listing, trash, projectTrash, projects, currentProject, selectedProjectId: projectId, types, newTitle, typeId, selected, draft, revisions, from, to,
            comparison, snapshotName, snapshotNote, error, busy, saving, dirty, save,
            folderId, folderName, folderParent, folderEditing, folderOptions, placement,
            browseFolder: id => run(async () => {
                selectFolder(id);
                await loadList();
            }),
            editFolder: () => {
                const folder = folders.value.find(item => item.id === folderId.value);
                folderEditing.value = true;
                folderName.value = folder.name;
                folderParent.value = folder.parent_id ?? 0;
            },
            cancelFolderEdit: () => selectFolder(folderId.value),
            saveFolder: () => run(async () => {
                const endpoint = folderPath() + (folderEditing.value ? '/' + folderId.value : '');
                const { data } = await contentRequest(endpoint, folderEditing.value ? 'PUT' : 'POST', {
                    name: folderName.value, parent_id: folderParent.value || null,
                });
                await loadFolders();
                selectFolder(data.id);
                await loadList();
            }),
            deleteFolder: () => run(async () => {
                if (!window.confirm('Supprimer cette collection ? Ses fiches seront conservées et ses sous-collections remonteront d’un niveau.')) return;
                await contentRequest(folderPath() + '/' + folderId.value, 'DELETE');
                selectFolder(0);
                await Promise.all([loadFolders(), loadList()]);
            }),
            memberships,
            beginDrag: (event, item) => {
                event.dataTransfer.setData('application/x-bifrost-content', item.content.public_id);
                event.dataTransfer.effectAllowed = 'copy';
            },
            dropInto: (event, item) => run(async () => {
                const id = event.dataTransfer.getData('application/x-bifrost-content');
                if (!id) return;
                await contentRequest(folderPath() + '/' + item.folder.id + '/contents/' + encodeURIComponent(id), 'PUT');
                await loadList(listing.value?.current_page);
            }),
            addMembership: () => run(async () => {
                await contentRequest(folderPath() + '/' + placement.value + path(), 'PUT');
                placement.value = 0;
                await loadList(listing.value?.current_page);
            }),
            removeMembership: id => run(async () => {
                await contentRequest(folderPath() + '/' + id + path(), 'DELETE');
                await loadList(listing.value?.current_page);
            }),
            catalogueSearch, catalogueType, catalogueStatus, searchWholeProject,
            searchCatalogue: () => run(async () => {
                appliedCatalogueFilters.value = {
                    search: catalogueSearch.value.trim(), type: catalogueType.value, status: catalogueStatus.value,
                    wholeProject: searchWholeProject.value,
                };
                await loadList();
            }),
            browse: page => run(() => loadList(page)),
            openContent: id => run(() => open(id)),
            close: () => {
                if (!dirty.value || window.confirm('Fermer et conserver le brouillon local ?')) {
                    selected.value = null;
                    draft.value = null;
                }
            },
            create: () => run(async () => {
                const { data } = await contentRequest('/contents', 'POST', { title: newTitle.value, content_type_id: typeId.value, project_id: projectId.value, folder_id: props.projectId ? folderId.value || null : null, template_version_id: versionId.value || null });
                newTitle.value = '';
                await loadList();
                await open(data.public_id);
            }),
            deleteContent: () => run(async () => {
                const { data } = await contentRequest(path() + '/deletion-impact');
                const count = Object.values(data).reduce((total, value) => total + value, 0);
                if (!window.confirm('Mettre cette fiche à la corbeille ? Références entrantes : ' + count + '.')) return;
                await contentRequest(path(), 'DELETE');
                selected.value = null;
                draft.value = null;
                await loadList();
            }),
            recover: id => run(async () => {
                await contentRequest((projectTrash.value ? '/projects/' : '/contents/') + id + '/recover', 'POST');
                await loadList(listing.value.current_page);
            }),
            browseHistory: page => run(() => loadHistory(page)),
            takeSnapshot: () => run(async () => {
                await contentRequest(path() + '/snapshots', 'POST', { label: snapshotName.value, note: snapshotNote.value || null });
                snapshotName.value = '';
                snapshotNote.value = '';
                await loadHistory();
            }),
            compare: () => run(async () => {
                comparison.value = (await contentRequest(path() + '/revisions/compare?from=' + from.value + '&to=' + to.value)).data.changes;
            }),
            restore: id => run(async () => {
                if (!window.confirm('Restaurer cette version ? L’état actuel restera dans l’historique.')) return;
                await contentRequest(path() + '/revisions/' + id + '/restore', 'POST');
                await open(selected.value.public_id);
                await loadList();
            }),
        };
    },
};
