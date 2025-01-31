import { supabase } from './supabase';

export const testAuth = async () => {
  try {
    // Test SELECT
    const { data: selectData, error: selectError } = await supabase
      .from('brands')
      .select('*')
      .limit(1);
    
    console.log('SELECT test:', { data: selectData, error: selectError });

    // Test raw query with auth
    const { data: rawData, error: rawError } = await supabase
      .rpc('test_auth')
      .select('*');

    console.log('RPC test:', { data: rawData, error: rawError });

    return true;
  } catch (error) {
    console.error('Auth test failed:', error);
    return false;
  }
};