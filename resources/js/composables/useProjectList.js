export function useProjectList(props) {
    function hasProjects() {
        return props.projects.length > 0;
    }

    return {
        hasProjects,
    };
}
