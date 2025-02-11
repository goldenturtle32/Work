import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

if (Platform.OS === 'web') {
  // This block only runs on web builds
  AppRegistry.registerComponent(appName, () => App);
  AppRegistry.runApplication(appName, {
    initialProps: {},
    rootTag: document.getElementById('root'),
  });
} else {
  // This block runs on iOS / Android
  registerRootComponent(App);
}
