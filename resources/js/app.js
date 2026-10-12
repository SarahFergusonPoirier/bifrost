import { createApp } from 'vue';
import { RouterLink, RouterView } from 'vue-router';

import App from './components/App.vue';
import router from './router';

const app = createApp(App);

app.component('RouterLink', RouterLink);
app.component('RouterView', RouterView);

app.use(router);
app.mount('#app');