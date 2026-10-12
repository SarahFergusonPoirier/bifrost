import { ref } from 'vue';

export function useProjectForm(props, emit) {
    const name = ref('');
    const description = ref('');

    function submitForm() {
        emit('submit', {
            name: name.value,
            description: description.value,
        });
    }

    function cancelForm() {
        emit('cancel');
    }

    return {
        name,
        description,
        submitForm,
        cancelForm,
    };
}
