// Połączenie z bazą Supabase (Project Settings -> API Keys).
// Klucz "publishable" jest jawny z założenia – zabezpieczają go reguły w supabase/setup.sql.
window.SKLEP_CONFIG = {
  supabaseUrl: 'https://yunwlaqinoqjvjdnmfbh.supabase.co',
  supabaseKey: 'sb_publishable_GBLjlB4Z-dojmnocxFxtyw_i3zQDrjl',
  // Publiczny numer WhatsApp Pawła (np. '48600123456') – po wysłaniu zgłoszenia klient zobaczy
  // przycisk „Napisz też na WhatsAppie”. Puste = przycisku nie ma.
  whatsapp: '48601556119'
};
