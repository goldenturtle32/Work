import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Check if running on the web or native
if (window && document) {
  AppRegistry.registerComponent(appName, () => App);
  AppRegistry.runApplication(appName, {
    initialProps: {},
    rootTag: document.getElementById('root'),
  });
} else {
  registerRootComponent(App); // Native app registration
}
