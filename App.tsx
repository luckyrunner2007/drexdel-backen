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