import NotificationCenter from './components/NotificationCenter.jsx';
import {installIncidentCapture,recordIncident} from './lib/incidents.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './components/AppErrorBoundary.jsx';
import './styles.css';
import {showCopyrightConsole} from './lib/copyrightConsole.js';

// Register the visible copyright notice immediately after loading the production app.
showCopyrightConsole();
installIncidentCapture();

createRoot(document.getElementById('root')).render(<React.StrictMode><NotificationCenter/><AppErrorBoundary><App /></AppErrorBoundary></React.StrictMode>);


// Installation and static asset download happen once while connected. IndexedDB
// handles the separately cached catalog and durable unsynchronized edits.
if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
 window.addEventListener('load',()=>{
  navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'})
   .then(registration=>{
    registration.update().catch(()=>{});
    navigator.storage?.persist?.().catch(()=>{});
  }).catch(error=>{recordIncident('hosting','runtime');console.warn('HSA offline shell setup failed:',error)});
 },{once:true});
}
