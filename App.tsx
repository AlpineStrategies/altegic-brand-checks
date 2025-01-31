   import React, { useEffect } from 'react';
   import { supabase } from './supabaseClient';

   const App = () => {
     useEffect(() => {
       const testAuthFunction = async () => {
         const { data, error } = await supabase.rpc('test_auth');

         if (error) {
           console.error('RPC call error:', error);
         } else {
           console.log('RPC call data:', data);
         }
       };

       testAuthFunction();
     }, []);

     return (
       <div>
         <h1>Welcome to the App</h1>
         {/* Other components and JSX */}
       </div>
     );
   };

   export default App;