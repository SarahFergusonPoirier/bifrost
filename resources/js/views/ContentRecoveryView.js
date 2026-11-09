import FicheReferenceCreate from '../components/fiche/FicheReferenceCreate.vue';
import FicheReferencePicker from '../components/fiche/FicheReferencePicker.vue';
import FicheText from '../components/fiche/FicheText.vue';
import { ageFromBirthDate } from '../components/fiche/characterAge';
import FicheTabs from '../components/fiche/FicheTabs.vue';
import FicheOverview from '../components/fiche/FicheOverview.vue';
import ProjectToolbar from '../components/ProjectToolbar.vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import ProjectOverview from './ProjectOverview.vue';
import WorkspaceIcon from '../components/WorkspaceIcon.vue';
import ContentAttachments from '../components/ContentAttachments.vue';
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
    components: { FicheReferenceCreate, FicheReferencePicker, FicheText, FicheTabs, FicheOverview, ProjectToolbar, ProjectOverview, WorkspaceIcon, ContentAttachments, AppLayout, ProjectDetailsView, StructuredField, ProjectTimeline, ProjectConnections, ProjectIdeas, ProjectNarrative },
    props: { projectId: { type: String, default: '' } },
    setup(props) {
        const folders = ref([]);
        const treeContents = ref([]);
        const panel = ref(props.projectId ? 'overview' : 'catalogue');
        const recentContents = computed(() => [...new Map(treeContents.value.map(item => [item.public_id, item])).values()]
            .sort((left, right) => String(right.updated_at ?? '').localeCompare(String(left.updated_at ?? '')))
            .slice(0, 8));
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
        const catalogueSort = ref('recent');
        const catalogueDisplay = ref('grid');
        const catalogueCreate = ref(false);
        const catalogueFolder = ref(false);
        const catalogueGroups = computed(() => {
            const groups = new Map();
            for (const item of listing.value?.data ?? []) {
                const key = item.content_type_id;
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(item);
            }
            return [...groups].map(([id, items]) => ({
                id, items,
                label: universeCategories.value.find(category => category.id === id)?.label
                    ?? types.value.find(type => type.id === id)?.name ?? 'Fiches',
            }));
        });
        const catalogueStatus = ref('');
        const catalogueTag = ref('');
        const tags = ref([]);
        const newTag = ref('');
        const searchWholeProject = ref(false);
        const appliedCatalogueFilters = ref({});
        const trash = ref(!props.projectId);
        const projectTrash = ref(!props.projectId);
        const projects = ref([]);
        const projectId = ref(props.projectId);
        const currentProject = computed(() => projects.value.find(project => String(project.id) === props.projectId));
        const types = ref([]);
        const countsByType = computed(() => {
            const counts = new Map();
            const seen = new Set();
            for (const item of treeContents.value) {
                if (seen.has(item.public_id)) continue;
                seen.add(item.public_id);
                counts.set(item.content_type_id, (counts.get(item.content_type_id) ?? 0) + 1);
            }
            return counts;
        });
        const universeCategories = computed(() => [
            ['personnage', 'Personnages'],
            ['lieu', 'Lieux'],
            ['organisation-faction', 'Organisations'],
            ['evenement-historique', 'Événements'],
            ['objet-artefact', 'Objets'],
            ['creature-animal', 'Faune'],
            ['plante-organisme', 'Flore'],
        ].map(([key, label]) => {
            const id = types.value.find(type => type.key === key && type.scope_type === 'system')?.id;
            return { key, label, id, count: countsByType.value.get(id) ?? 0 };
        }));
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
        const ficheTab = ref('overview');
        const compact = ref(false);
        const hiddenFields = ref([]);
        const showHidden = ref(false);
        const displayKey = () => 'bifrost:content-display:' + selected.value.public_id;

        function loadDisplay() {
            ficheTab.value = 'overview';
            compact.value = false;
            hiddenFields.value = [];
            showHidden.value = false;
            try {
                const preference = JSON.parse(localStorage.getItem(displayKey()) ?? '{}');
                compact.value = preference.compact === true;
                if (typeof preference.tab === 'string' && /^[a-z0-9-]{1,64}$/.test(preference.tab)) {
                    ficheTab.value = preference.tab;
                }
                hiddenFields.value = Array.isArray(preference.hidden) ? preference.hidden : [];
            } catch {
                // A missing preference leaves all fields visible.
            }
        }

        function rememberDisplay() {
            try {
                localStorage.setItem(displayKey(), JSON.stringify({ compact: compact.value, hidden: hiddenFields.value, tab: ficheTab.value }));
            } catch {
                // Display preferences still apply while the fiche is open.
            }
        }

        function selectFicheTab(id) {
            ficheTab.value = id;
            rememberDisplay();
        }

        function toggleHidden(id) {
            hiddenFields.value = hiddenFields.value.includes(id)
                ? hiddenFields.value.filter(field => field !== id)
                : [...hiddenFields.value, id];
            rememberDisplay();
        }

        function setCompact(value) {
            compact.value = value;
            showHidden.value = false;
            rememberDisplay();
        }
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
            boolean: 'value_boolean', date: 'value_date', json: 'value_json', reference: 'reference_content_id',
        };
        const templateSections = computed(() => {
            const sections = new Map();
            for (const field of selected.value?.template_assignment?.template_version?.fields ?? []) {
                const column = fieldColumns[field.field_definition?.value_type];
                const format = field.field_definition?.options_data?.format;
                if (!column || (column === 'value_json' && !['measurement', 'coordinates', 'temporal', 'references', 'multiple_choice', 'scale', 'keywords', 'equipment', 'capabilities', 'repeatable', 'bullets', 'external_link'].includes(format))) continue;
                const section = field.display_options?.section_label ?? field.section_key ?? 'Informations';
                if (!sections.has(section)) sections.set(section, []);
                sections.get(section).push({ ...field, column, format });
            }
            return sections;
        });
        const fieldValue = field => draft.value.field_values?.find(value =>
            value.field_definition_id === field.field_definition_id
        )?.[field.column] ?? '';
        const suggestedFullName = computed(() => {
            if (!draft.value) return '';
            const fields = templateSections.value.get('Identité') ?? [];
            const names = ['Prénom', 'Nom de famille'].map(label => {
                const field = fields.find(item => item.column === 'value_text' && item.field_definition.label === label);
                return field ? String(fieldValue(field)).trim() : '';
            });
            if (names.some(name => !name)) return '';
            const fullName = names.join(' ');
            return fullName.length <= 255 ? fullName : '';
        });

        function useSuggestedFullName() {
            if (suggestedFullName.value) draft.value.title = suggestedFullName.value;
        }

        const referenceIndex = computed(() => {
            const index = new Map();
            for (const item of treeContents.value) {
                index.set(String(item.id), item);
                index.set(item.public_id, item);
            }
            return index;
        });

        function resolveFicheReference(id) {
            return referenceIndex.value.get(id)?.title;
        }

        function fieldReferences(field, value = fieldValue(field)) {
            if (value === '') return [];
            const ids = field.column === 'reference_content_id' ? [value]
                : field.format === 'references' && Array.isArray(value) ? value : [];
            return ids.map(id => {
                const item = referenceIndex.value.get(String(id));
                return { id, title: item?.title ?? 'Fiche indisponible', publicId: item?.public_id };
            });
        }

        function fieldState(field) {
            return draft.value?.field_values?.find(item => item.field_definition_id === field.field_definition_id)?.value_state;
        }

        function setFieldState(field, state) {
            setField(field, state ? { value_state: state } : '');
        }

        function effectiveFieldValue(field) {
            const value = fieldValue(field);
            if (value !== '' || fieldState(field) || field.field_definition.key !== 'character-age') return value;
            const birthField = (templateSections.value.get('Identité') ?? []).find(item =>
                item.field_definition.label === 'Date de naissance' && item.format === 'temporal');
            return birthField ? ageFromBirthDate(fieldValue(birthField)) ?? '' : '';
        }

        function formatHistoricalValue(field, entry) {
            let value = entry?.[field.column] ?? '';
            if (field.column === 'value_json' && typeof value === 'string' && value !== '') {
                try {
                    value = JSON.parse(value);
                } catch {
                    return value;
                }
            }
            return formatFieldValue(field, value, entry?.value_state);
        }

        function displayValue(field) {
            return formatFieldValue(field, effectiveFieldValue(field), fieldState(field));
        }

        function formatFieldValue(field, value, state) {
            if (state) return state === 'unknown' ? 'Inconnu' : 'Non applicable';
            if (value === '') return '—';
            if (field.column === 'reference_content_id' || field.format === 'references') {
                return fieldReferences(field, value).map(item => item.title).join(', ') || '—';
            }
            if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
            if (field.format === 'external_link') return value.label || value.url;
            if (['keywords', 'equipment', 'capabilities', 'repeatable', 'bullets'].includes(field.format)) return value.map(keyword => keyword.label).join(', ');
            if (field.format === 'scale') {
                const levels = field.display_options?.scale_levels ?? field.field_definition.options_data?.levels ?? 5;
                return value.level > levels ? value.level + ' (valeur conservée, maximum actuel : ' + levels + ')' : value.level + ' / ' + levels;
            }
            if (field.format === 'measurement') return [value.amount, value.unit].filter(part => part != null).join(' ');
            if (field.format === 'coordinates') return [value.x, value.y].filter(part => part != null).join(' · ');
            if (field.format === 'temporal') return [value.start, value.end, value.calendar].filter(Boolean).join(' · ') || 'Date inconnue';
            if (field.format === 'multiple_choice') return value.join(', ');
            return value;
        }

        function choiceOptions(field) {
            const choices = field.display_options?.choices ?? field.field_definition?.options_data?.choices ?? [];
            const value = fieldValue(field);
            return [...new Set([...choices, ...(Array.isArray(value) ? value : value ? [value] : [])])];
        }

        function setMultipleChoice(field, event) {
            const values = [...event.target.selectedOptions].map(option => option.value);
            setField(field, values.length ? values : '');
        }

        function allowedTargets(field) {
            const allowed = field.field_definition?.options_data?.content_type_ids ?? [];
            return [...new Map(treeContents.value.map(item => [item.id, item])).values()]
                .filter(item => item.public_id !== selected.value?.public_id && (!allowed.length || allowed.some(id => Number(id) === Number(item.content_type_id))));
        }

        function referenceCreationTypes(field) {
            const ids = field.field_definition?.options_data?.content_type_ids ?? [];
            return types.value.filter(type => !ids.length || ids.some(id => Number(id) === Number(type.id)));
        }

        function referenceFieldIsFull(field) {
            return field.format === 'references' && fieldValue(field).length >= 200;
        }

        function useCreatedReference(field, content) {
            if (!draft.value || Number(content.project_id) !== Number(projectId.value)) return;
            if (!treeContents.value.some(item => item.public_id === content.public_id)) {
                treeContents.value = [...treeContents.value, { ...content, folder_id: null }];
            }
            if (referenceFieldIsFull(field)) return;
            const current = fieldValue(field);
            setField(field, field.format === 'references' ? [...(Array.isArray(current) ? current : []), content.public_id] : content.id);
        }

        function setField(field, value) {
            const values = draft.value.field_values ??= [];
            const index = values.findIndex(item => item.field_definition_id === field.field_definition_id);
            if (value === '') {
                if (index >= 0) values.splice(index, 1);
                return;
            }

            const entry = {
                field_definition_id: field.field_definition_id,
                ...(value?.value_state ? { value_state: value.value_state }
                    : { [field.column]: field.column === 'value_boolean' ? value === 'true' : value }),
            };
            if (index >= 0) values.splice(index, 1, entry);
            else values.push(entry);
        }

        function currentTemplateValues(values) {
            const fields = selected.value?.template_assignment?.template_version?.fields;
            if (!fields) return values;
            const ids = new Set(fields.filter(field => field.field_definition).map(field => field.field_definition_id));
            return values.filter(value => ids.has(value.field_definition_id));
        }

        function accept(data, token) {
            selected.value = data;
            const editable = {
                title: data.title,
                summary: data.summary,
                ...(data.tags ? { tag_ids: data.tags.map(tag => tag.id) } : {}),
                ...(data.work_status_key ? { work_status_key: data.work_status_key } : {}),
                blocks: data.blocks.map(({ public_id, block_type, title, body }) => ({
                    public_id, block_type, title, body,
                })),
            };
            if (templateSections.value.size) {
                editable.field_values = currentTemplateValues(data.field_values ?? []).map(({ id, content_id, created_at, updated_at, value_state, ...value }) => ({
                    ...value,
                    ...(value_state ? { value_state } : {}),
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
                    params.set('sort', catalogueSort.value);
                    const filters = appliedCatalogueFilters.value;
                    if (!filters.wholeProject) params.set('folder_id', folderId.value);
                    for (const key of ['search', 'type', 'status', 'tag']) {
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
            loadDisplay();
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
                    if (Array.isArray(draft.value.field_values)) {
                        draft.value.field_values = currentTemplateValues(draft.value.field_values);
                    }
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
                const tagList = await contentRequest('/tags');
                tags.value = Array.isArray(tagList.data) ? tagList.data : [];
                types.value = data.filter(type => ['system', 'global'].includes(type.scope_type)
                    || (type.scope_type === 'project' && String(type.project_id) === props.projectId));
            });
        });
        onUnmounted(() => {
            clearTimeout(timer);
            window.removeEventListener('beforeunload', preventLeave);
        });

        return {
            referenceTargets: computed(() => [...new Map(treeContents.value.map(item => [item.public_id, item])).values()]
                .filter(item => item.public_id !== selected.value?.public_id)),
            refreshFiche: () => run(async () => {
                const id = selected.value.public_id;
                const response = await contentRequest('/contents/' + id);
                if (selected.value?.public_id === id && !dirty.value) accept(response.data, response.version);
            }),
            ficheTab, selectFicheTab, compact, hiddenFields, showHidden, setCompact, toggleHidden, displayValue, formatHistoricalValue, effectiveFieldValue, resolveFicheReference, fieldReferences, fieldState, setFieldState,
            suggestedFullName, useSuggestedFullName, sidebarItems, templateSections, fieldValue, setField, allowedTargets, referenceCreationTypes, referenceFieldIsFull, useCreatedReference, choiceOptions, setMultipleChoice, templateId, templateOptions, versions, versionId,
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
            panel, recentContents,
            overviewFolders: computed(() => folders.value.filter(folder => folder.parent_id === null).slice(0, 5)),
            overviewCatalogue: async focus => {
                await run(async () => {
                    panel.value = 'catalogue';
                    trash.value = false;
                    selectFolder(0);
                    searchWholeProject.value = true;
                    catalogueType.value = '';
                    appliedCatalogueFilters.value = { wholeProject: true };
                    if (focus === 'catalogue-create-title') catalogueCreate.value = true;
                    if (focus === 'catalogue-folder-name') catalogueFolder.value = true;
                    await loadList();
                });
                await nextTick();
                if (focus) document.getElementById(focus)?.focus();
            },
            overviewSearch: query => run(async () => {
                panel.value = 'catalogue';
                trash.value = false;
                catalogueSearch.value = query.trim();
                catalogueType.value = '';
                catalogueStatus.value = '';
                catalogueTag.value = '';
                searchWholeProject.value = true;
                appliedCatalogueFilters.value = { search: catalogueSearch.value, wholeProject: true };
                await loadList();
            }),
            openPanel: next => {
                if (dirty.value && !window.confirm('Conserver le brouillon et changer de vue ?')) return;
                selected.value = null;
                draft.value = null;
                panel.value = next;
            },
            openPanelContent: id => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir cette fiche ?')) return;
                panel.value = 'catalogue';
                trash.value = false;
                await loadList();
                await open(id);
            }),
            openProjectTrash: () => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir la corbeille ?')) return;
                panel.value = 'catalogue';
                selected.value = null;
                draft.value = null;
                trash.value = true;
                await loadList();
            }),
            openTreeItem: item => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir cet élément ?')) return;
                panel.value = 'catalogue';
                selected.value = null;
                draft.value = null;
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
                catalogueFolder.value = true;
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
            catalogueTotal: computed(() => new Set(treeContents.value.map(item => item.public_id)).size),
            catalogueGroups, catalogueSort, catalogueDisplay, catalogueCreate, catalogueFolder, catalogueSearch, catalogueType, catalogueStatus, catalogueTag, tags, newTag, searchWholeProject,
            addTag: () => run(async () => {
                if (!newTag.value.trim()) return;
                const { data } = await contentRequest('/tags', 'POST', { name: newTag.value.trim() });
                if (!tags.value.some(tag => tag.id === data.id)) tags.value.push(data);
                if (!draft.value.tag_ids.includes(data.id)) draft.value.tag_ids.push(data.id);
                newTag.value = '';
            }),
            universeCategories, appliedCatalogueFilters,
            openCategory: id => run(async () => {
                if (dirty.value && !window.confirm('Conserver le brouillon et ouvrir cette catégorie ?')) return;
                selected.value = null;
                draft.value = null;
                panel.value = 'catalogue';
                trash.value = false;
                catalogueType.value = id ?? '';
                catalogueSearch.value = '';
                catalogueStatus.value = '';
                catalogueTag.value = '';
                searchWholeProject.value = true;
                appliedCatalogueFilters.value = { type: catalogueType.value, wholeProject: true };
                await loadList();
            }),
            searchCatalogue: () => run(async () => {
                appliedCatalogueFilters.value = {
                    search: catalogueSearch.value.trim(), type: catalogueType.value, status: catalogueStatus.value,
                    tag: catalogueTag.value, wholeProject: searchWholeProject.value,
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
