// Configuração do Taskhub.
// Deixe SUPABASE_URL e SUPABASE_ANON_KEY vazios para usar o modo local
// (dados salvos só neste navegador). Preencha para sincronizar entre dispositivos.
// SUPABASE_ANON_KEY aceita a Publishable key (sb_publishable_...) ou a anon legada.
// É pública por design: quem protege os dados é o RLS do schema.sql. Nunca use a secret/service_role.
window.TASKHUB_CONFIG = {
  APP_NAME: 'Taskhub',
  SUPABASE_URL: 'https://pumbsaideunzmpbmbuqt.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1bWJzYWlkZXVuem1wYm1idXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ0NzEyNzcsImV4cCI6MjExMDA0NzI3N30.bNjQxZE8JkGGdsSkjXY68605aGwDDRnM0MSDlpoP5lQ'
};
