-- Seed data para CRM Saúde PRO
-- Usuário ADM (senha: admin123)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, phone, active) VALUES 
  ('usr_admin_001', 'Administrador', 'admin@crmsaudepro.com', '$2b$12$abFRndnI8EFlXEsJjAN4mOIKtIvieVQmV1bO8CynXeQ/4VkrKaf12', 'admin', NULL, 1);

-- Usuário Diretor (senha: *G19g2704)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, phone, active) VALUES 
  ('usr_director_001', 'Gabriel', 'gabriel.comercialtopprime@gmail.com', '$2b$12$wweaOWYCPQqNbn8TvcEGUOjwrQu4T6On/JA5Vj/rUX2i8xpUpTgZK', 'director', NULL, 1);

-- Leads de exemplo
INSERT OR IGNORE INTO leads (id, name, email, phone, lead_type, pipeline_stage, source, estimated_value, assigned_to, created_by) VALUES
  ('lead_001', 'Maria Silva', 'maria@email.com', '(11) 99999-1111', 'pf', 'new_lead', 'Indicação', 350.00, 'usr_director_001', 'usr_director_001'),
  ('lead_002', 'João Santos', 'joao@email.com', '(11) 99999-2222', 'pf', 'first_contact', 'Site', 280.00, 'usr_director_001', 'usr_director_001'),
  ('lead_003', 'Empresa ABC Ltda', 'contato@abc.com.br', '(11) 3333-4444', 'pme', 'qualification', 'LinkedIn', 8500.00, 'usr_director_001', 'usr_director_001'),
  ('lead_004', 'Carlos Oliveira', 'carlos@email.com', '(11) 99999-3333', 'adhesion', 'proposal', 'WhatsApp', 420.00, 'usr_director_001', 'usr_director_001'),
  ('lead_005', 'Tech Solutions EIRELI', 'ti@techsol.com', '(11) 2222-5555', 'pme', 'negotiation', 'Indicação', 15000.00, 'usr_director_001', 'usr_director_001');
