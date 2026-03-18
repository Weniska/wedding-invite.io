(function initSupabase() {
  const { supabaseUrl, supabaseAnonKey } = window.APP_CONFIG || {};

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase config in assets/js/config.js");
    return;
  }

  window.sb = supabase.createClient(supabaseUrl, supabaseAnonKey);
})();
