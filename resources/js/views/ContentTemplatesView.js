import { computed, onMounted, ref, watch } from 'vue';
import { getContentTemplate, getContentTemplates } from '../services/contentTemplate';

import { contentRequest } from '../services/contentRecovery';

const scopeLabels = {
    global: 'Global',
    universe: 'Univers',
    project: 'Projet',
};

export default {
    setup() {
        const templates = ref([]);
        const details = ref({});

        async function loadDetails(id) {
            if (details.value[id]?.versions || details.value[id]?.loading) return;
            details.value[id] = { loading: true };
            try {
                details.value[id] = await getContentTemplate(id);
            } catch (error) {
                details.value[id] = { error: error.message };
            }
        }
        const editor = ref(null);
        const typeEditor = ref(null);
        const editorError = ref('');
        const saving = ref(false);
        const types = ref([]);
        const projects = ref([]);
        const availableTypes = computed(() => types.value.filter(type => ['system', 'global'].includes(type.scope_type)
            || (type.scope_type === 'project' && Number(type.project_id) === Number(editor.value?.project_id))));

        watch(() => editor.value?.project_id, () => {
            if (editor.value && !editor.value.base_version_id && !availableTypes.value.some(type => type.id === editor.value.content_type_id)) {
                editor.value.content_type_id = '';
            }
        });

        const fieldTypes = {
            text: 'Texte', number: 'Nombre', boolean: 'Oui ou non', date: 'Date', choice: 'Choix',
            reference: 'Référence', json: 'Données structurées', measurement: 'Mesure', coordinates: 'Coordonnées',
            temporal: 'Date ou période fictive', references: 'Références multiples', multiple_choice: 'Choix multiple', scale: 'Échelle segmentée', keywords: 'Mots-clés libres',
        };

        async function editTemplate(template = null, copy = false) {
            if (saving.value) return;
            saving.value = true;
            editorError.value = '';
            try {
                const [typeList, projectList, source] = await Promise.all([
                    contentRequest('/content-types'),
                    contentRequest('/projects'),
                    template ? getContentTemplate(template.id) : null,
                ]);
                types.value = typeList.data;
                projects.value = projectList.data;
                const version = source?.versions.at(-1);
                editor.value = {
                    id: copy ? null : template?.id,
                    base_version_id: copy ? version?.id : null,
                    from_version_id: copy ? null : version?.id,
                    name: copy ? 'Copie de ' + template.name : template?.name ?? '',
                    description: template?.description ?? '',
                    project_id: template?.project_id ?? '',
                    content_type_id: template?.content_type_id ?? '',
                    fields: (version?.fields ?? []).map(field => ({
                        id: field.field_definition_id,
                        label: field.label_override ?? field.field_definition?.label ?? '',
                        section: field.display_options?.section_label ?? field.section_key,
                        type: fieldTypes[field.field_definition?.options_data?.format] ? field.field_definition.options_data.format : field.field_definition?.value_type ?? 'text',
                        levels: field.field_definition?.options_data?.levels,
                        levelDescriptions: (field.display_options?.level_descriptions ?? []).join('\n'),
                        badgeColor: field.display_options?.badge_color ?? '',
                        scaleDisplay: field.display_options?.scale_display ?? 'both',
                        choicesText: (field.display_options?.choices ?? field.field_definition?.options_data?.choices ?? []).join('\n'),
                        help: field.help_text ?? '', required: Boolean(field.is_required),
                    })),
                };
            } catch (error) {
                editorError.value = error.message;
            } finally {
                saving.value = false;
            }
        }

        async function startType() {
            if (saving.value) return;
            saving.value = true;
            editorError.value = '';
            try {
                projects.value = (await contentRequest('/projects')).data;
                typeEditor.value = { name: '', description: '', project_id: '' };
            } catch (error) {
                editorError.value = error.message;
            } finally {
                saving.value = false;
            }
        }

        async function saveType() {
            if (saving.value) return;
            saving.value = true;
            editorError.value = '';
            try {
                const { data: type } = await contentRequest('/content-types', 'POST', {
                    ...typeEditor.value, project_id: typeEditor.value.project_id || null,
                });
                typeEditor.value = null;
                saving.value = false;
                await editTemplate();
                if (editor.value) {
                    editor.value.name = type.name;
                    editor.value.project_id = type.project_id ?? '';
                    editor.value.content_type_id = type.id;
                }
            } catch (error) {
                editorError.value = error.message;
            } finally {
                saving.value = false;
            }
        }

        function moveField(index, offset) {
            const [field] = editor.value.fields.splice(index, 1);
            editor.value.fields.splice(index + offset, 0, field);
        }

        async function saveTemplate() {
            if (saving.value) return;
            saving.value = true;
            editorError.value = '';
            try {
                const { id, from_version_id, base_version_id, fields, name, description, project_id, content_type_id } = editor.value;
                const payloadFields = fields.map(({ choicesText, levels, levelDescriptions, scaleDisplay, badgeColor, ...field }) => ({
                    ...field,
                    ...(field.type === 'choice' ? { badge_color: badgeColor || null } : {}),
                    ...(field.type === 'scale' ? {
                        levels: levels ?? 5,
                        level_descriptions: (levelDescriptions ?? '').split('\n').slice(0, levels ?? 5).map(line => line.trim() || null),
                        scale_display: scaleDisplay ?? 'both',
                    } : {}),
                    ...(['choice', 'multiple_choice'].includes(field.type)
                        ? { choices: (choicesText ?? '').split('\n').map(option => option.trim()).filter(Boolean) }
                        : {}),
                }));
                if (id) {
                    await contentRequest('/content-templates/' + id + '/versions', 'POST', { from_version_id, fields: payloadFields });
                    delete details.value[id];
                } else {
                    await contentRequest('/content-templates', 'POST', {
                        name, description, project_id: project_id || null, content_type_id, base_version_id, fields: payloadFields,
                    });
                }
                editor.value = null;
                await loadTemplates();
            } catch (error) {
                editorError.value = error.message;
            } finally {
                saving.value = false;
            }
        }

        const scopeFilter = ref('all');
        const statusFilter = ref('active');
        const searchQuery = ref('');
        const loading = ref(false);
        const loadError = ref('');

        const hasFilters = computed(() =>
            scopeFilter.value !== 'all' ||
            statusFilter.value !== 'active' ||
            searchQuery.value.trim() !== ''
        );

        async function loadTemplates() {
            loading.value = true;
            loadError.value = '';

            try {
                templates.value = await getContentTemplates({
                    scope: scopeFilter.value,
                    status: statusFilter.value,
                    search: searchQuery.value,
                });
            } catch (error) {
                loadError.value =
                    error.message || 'Impossible de charger les modèles.';
            } finally {
                loading.value = false;
            }
        }

        function getScopeLabel(template) {
            return scopeLabels[template.scope_type] || template.scope_type;
        }

        function getScopeContext(template) {
            if (template.scope_type === 'project') {
                return template.project?.name || 'Projet introuvable';
            }

            if (template.scope_type === 'universe') {
                return template.universe?.name || 'Univers introuvable';
            }

            return 'Disponible dans tous les projets';
        }

        watch([scopeFilter, statusFilter], loadTemplates);

        let searchTimeout;
        watch(searchQuery, () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadTemplates, 250);
        });

        onMounted(loadTemplates);

        return {
            templates, details, loadDetails, editor, editorError, saving, availableTypes, projects, typeEditor, startType, saveType, fieldTypes, editTemplate, moveField, saveTemplate,
            scopeFilter,
            statusFilter,
            searchQuery,
            loading,
            loadError,
            hasFilters,
            loadTemplates,
            getScopeLabel,
            getScopeContext,
        };
    },
};
