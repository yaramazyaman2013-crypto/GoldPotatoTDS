// Browser-side Supabase config. Both values are safe to expose — the
// publishable key only grants whatever the RLS policy allows.
window.SUPABASE_CONFIG = {
  url: 'https://cvrvsvcerozopnwkmwhs.supabase.co',
  key: 'sb_publishable_fCbHGkQcx8CnMcjt2XQ3Zw_xsPdm8kS',
};

// Map editor password. Required to save or delete maps. Soft client-side gate
// (the publishable key still allows raw writes); change it here when you want
// to rotate.
window.MAP_EDITOR_PASSWORD = 'goldwave2026';
