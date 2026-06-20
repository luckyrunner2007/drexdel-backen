// At the top of App.tsx
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    button::-moz-focus-inner { border: 0; padding: 0; }
  `;
  document.head.appendChild(style);
}
import React from 'react';
import { View, Text } from 'react-native';
export default function App() {
  return <View style={{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#FAFE'}}><Text style={{color:'#7B2CBF',fontSize:24,fontWeight:'700'}}>DREXDEL LOADED ✅</Text></View>;
}
import React from 'react';
import { View, Text } from 'react-native';
import { AppRegistry } from 'react-native';

function App() {
  return (
    <View style={{flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#FAFE'}}>
      <Text style={{color:'#7B2CBF', fontSize:24, fontWeight:'700'}}>
        DREXDEL LOADED ✅
      </Text>
    </View>
  );
}

// Register the app
AppRegistry.registerComponent('main', () => App);

// For web, manually mount if needed
if (typeof document !== 'undefined') {
  const rootTag = document.getElementById('root');
  AppRegistry.runApplication('main', { rootTag });
}

export default App;