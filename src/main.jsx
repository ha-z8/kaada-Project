import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);


// Installation and static asset download happen once while connected. IndexedDB
// handles the separately cached catalog and durable unsynchronized edits.
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})
   .then(registration=>{
    registration.update().catch(()=>{});
    navigator.storage?.persist?.().catch(()=>{});
  }).catch(error=>console.warn('HSA offline shell setup failed:',error));
 },{once:true});
}
