// createApp: Vue ka function jo naya app banata hai
import { createApp } from "vue";
// App.vue: hamara sabse bara/root component
import App from "./App.vue";

// App component ko banao aur #app div ke andar mount (attach) kar do
createApp(App).mount("#app");
